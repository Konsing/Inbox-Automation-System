import type { Email } from "./types";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text: string }>;
}

function priorityEmoji(priority: string): string {
  switch (priority) {
    case "urgent": return "\u{1F534}";
    case "high": return "\u{1F7E0}";
    case "medium": return "\u{1F7E1}";
    case "low": return "\u{1F7E2}";
    default: return "\u26AA";
  }
}

export function formatSlackDigest(emails: Email[], dashboardUrl: string): SlackBlock[] {
  const urgent = emails.filter((e) => e.priority === "urgent" || e.priority === "high");
  const other = emails.filter((e) => e.priority !== "urgent" && e.priority !== "high");

  const blocks: SlackBlock[] = [];

  // Urgent section
  if (urgent.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\u{1F6A8} *Urgent Emails (${urgent.length})*`,
      },
    });
    blocks.push({ type: "divider" });

    for (const email of urgent) {
      const name = email.from_name || email.from_address;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\u2022 *${name}* \u2014 ${email.summary ?? email.subject}\n  \u23F0 ${email.reply_deadline ?? "Reply soon"} | \u{1F4C2} ${email.category ?? "General"} | ${priorityEmoji(email.priority ?? "medium")} ${email.priority}`,
        },
      });
    }
  }

  // Other section
  if (other.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\u{1F4EC} *Other Emails (${other.length})*`,
      },
    });

    // Group by category
    const grouped: Record<string, Email[]> = {};
    for (const email of other) {
      const cat = email.category ?? "general";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(email);
    }

    const lines = Object.entries(grouped)
      .map(([cat, items]) => {
        const summaries = items.map((e) => e.summary ?? e.subject).join(", ");
        return `\u{1F4C2} *${cat.charAt(0).toUpperCase() + cat.slice(1)} (${items.length})* \u2014 ${summaries}`;
      })
      .join("\n");

    blocks.push({ type: "section", text: { type: "mrkdwn", text: lines } });
  }

  // Footer
  blocks.push({ type: "divider" });
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `\u{1F517} <${dashboardUrl}|View details & reply>`,
    },
  });

  return blocks;
}

export async function postSlackDigest(emails: Email[], webhookUrl: string, dashboardUrl: string): Promise<void> {
  const blocks = formatSlackDigest(emails, dashboardUrl);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`);
  }
}
