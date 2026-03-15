import { getSupabase } from "./supabase";
import { fetchUnreadEmails } from "./gmail";
import { classifyAndRespondEmail } from "./gemini";
import { postSlackDigest } from "./slack";
import type { SyncEvent, Email, EmailClassification } from "./types";

async function classifyAndRespondBatch(
  emails: Array<{ subject: string; body_text: string; from_address: string }>,
  batchSize: number
): Promise<Array<{ classification: EmailClassification; draftReply: string }>> {
  const results: Array<{ classification: EmailClassification; draftReply: string }> = [];
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((e) => classifyAndRespondEmail(e.subject, e.body_text, e.from_address))
    );
    results.push(...batchResults);
  }
  return results;
}

export async function* runSyncPipeline(accountId: string): AsyncGenerator<SyncEvent> {
  const supabase = getSupabase();

  // Step 1: Authenticate
  yield { step: "authenticating", detail: "Verifying credentials..." };

  // Check concurrent sync
  const { data: account } = await supabase
    .from("accounts")
    .select("last_sync_at, email")
    .eq("id", accountId)
    .single();

  if (!account) throw new Error("Account not found");

  if (account.last_sync_at) {
    const lastSync = new Date(account.last_sync_at).getTime();
    if (Date.now() - lastSync < 30000) {
      throw new Error("Please wait before syncing again");
    }
  }

  await supabase
    .from("accounts")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", accountId);

  // Step 2: Fetch emails
  yield { step: "fetching", detail: "Fetching unread emails..." };

  const rawEmails = await fetchUnreadEmails(accountId);

  if (rawEmails.length === 0) {
    yield { step: "done", detail: "No unread emails found", stats: { urgent: 0, high: 0, medium: 0, low: 0 } };
    return;
  }

  yield { step: "fetching", detail: `Found ${rawEmails.length} unread emails`, progress: { current: 0, total: rawEmails.length } };

  // Step 3: Classify + generate replies in single AI call per email (batches of 2 for 5 RPM limit)
  yield { step: "classifying", detail: `Classifying ${rawEmails.length} emails...`, progress: { current: 0, total: rawEmails.length } };

  const aiResults = await classifyAndRespondBatch(
    rawEmails.map((e) => ({ subject: e.subject, body_text: e.body_text, from_address: e.from_address })),
    2
  );

  const classifications = aiResults.map((r) => r.classification);

  yield { step: "classifying", detail: `Classified ${rawEmails.length} emails`, progress: { current: rawEmails.length, total: rawEmails.length } };

  // Step 4: Drafts already generated — filter to urgent/high only
  yield { step: "drafting", detail: "Processing draft replies..." };

  // Step 5: Store in Supabase
  yield { step: "storing", detail: "Saving to database..." };

  const emailRows = rawEmails.map((raw, i) => ({
    account_id: accountId,
    gmail_id: raw.gmail_id,
    gmail_message_id: raw.gmail_message_id,
    thread_id: raw.thread_id,
    from_address: raw.from_address,
    from_name: raw.from_name,
    subject: raw.subject,
    snippet: raw.snippet,
    body_text: raw.body_text,
    received_at: raw.received_at,
    category: classifications[i].category,
    priority: classifications[i].priority,
    sentiment: classifications[i].sentiment,
    summary: classifications[i].summary,
    reply_deadline: classifications[i].reply_deadline,
    draft_reply: (classifications[i].priority === "urgent" || classifications[i].priority === "high")
      ? aiResults[i].draftReply
      : null,
  }));

  await supabase.from("emails").upsert(emailRows, { onConflict: "gmail_id" });

  // Step 6: Slack digest
  yield { step: "notifying", detail: "Posting Slack digest..." };

  // Fetch stored emails to get full records with IDs
  const { data: storedEmails } = await supabase
    .from("emails")
    .select("*")
    .eq("account_id", accountId)
    .in("gmail_id", rawEmails.map((e) => e.gmail_id));

  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  if (slackWebhook && storedEmails && storedEmails.length > 0) {
    try {
      const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-app.vercel.app/dashboard";
      await postSlackDigest(storedEmails as Email[], slackWebhook, dashboardUrl);
    } catch {
      // Slack is non-critical, continue
    }
  }

  // Step 7: Done
  const stats = {
    urgent: classifications.filter((c) => c.priority === "urgent").length,
    high: classifications.filter((c) => c.priority === "high").length,
    medium: classifications.filter((c) => c.priority === "medium").length,
    low: classifications.filter((c) => c.priority === "low").length,
  };

  yield { step: "done", detail: `Sync complete: ${stats.urgent} urgent, ${stats.high} high, ${stats.medium + stats.low} other`, stats };
}
