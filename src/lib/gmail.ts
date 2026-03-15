import { google, gmail_v1 } from "googleapis";
import { getSupabase } from "@/lib/supabase";
import { encryptToken, decryptToken } from "@/lib/crypto";

export interface RawEmail {
  gmail_id: string;
  gmail_message_id: string | null;
  thread_id: string | null;
  from_address: string;
  from_name: string | null;
  subject: string;
  snippet: string;
  body_text: string;
  received_at: string;
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
}

export async function getAuthenticatedClient(accountId: string) {
  const supabase = getSupabase();
  const { data: account, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (error || !account) throw new Error("Account not found");

  const oauth2Client = getOAuth2Client();
  const accessToken = decryptToken(account.access_token);
  const refreshToken = decryptToken(account.refresh_token);

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: new Date(account.token_expiry).getTime(),
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await supabase
        .from("accounts")
        .update({
          access_token: encryptToken(tokens.access_token),
          token_expiry: new Date(tokens.expiry_date ?? Date.now() + 3600000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);
    }
  });

  return { gmail: google.gmail({ version: "v1", auth: oauth2Client }), account };
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFrom(from: string): { address: string; name: string | null } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, "").trim(), address: match[2] };
  return { name: null, address: from };
}

function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  // Try text/plain first
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Check parts recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }
    // Fall back to text/html stripped
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = Buffer.from(part.body.data, "base64url").toString("utf-8");
        return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
  }

  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  return "";
}

export async function fetchUnreadEmails(accountId: string): Promise<RawEmail[]> {
  const { gmail } = await getAuthenticatedClient(accountId);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread",
    maxResults: 10,
  });

  const messageIds = listRes.data.messages ?? [];
  if (messageIds.length === 0) return [];

  const emails: RawEmail[] = [];

  for (const msg of messageIds) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
    });

    const headers = detail.data.payload?.headers;
    const fromRaw = getHeader(headers, "From");
    const { address, name } = parseFrom(fromRaw);

    emails.push({
      gmail_id: msg.id!,
      gmail_message_id: getHeader(headers, "Message-ID") || null,
      thread_id: detail.data.threadId ?? null,
      from_address: address,
      from_name: name,
      subject: getHeader(headers, "Subject") || "(no subject)",
      snippet: detail.data.snippet ?? "",
      body_text: extractBody(detail.data.payload!),
      received_at: new Date(parseInt(detail.data.internalDate ?? "0")).toISOString(),
    });
  }

  return emails;
}

export async function sendReply(
  accountId: string,
  params: {
    to: string;
    subject: string;
    body: string;
    threadId: string | null;
    inReplyTo: string | null;
    fromEmail: string;
  }
): Promise<void> {
  const { gmail } = await getAuthenticatedClient(accountId);

  const replySubject = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject}`;

  const headerLines = [
    `From: ${params.fromEmail}`,
    `To: ${params.to}`,
    `Subject: ${replySubject}`,
    params.inReplyTo ? `In-Reply-To: ${params.inReplyTo}` : null,
    params.inReplyTo ? `References: ${params.inReplyTo}` : null,
    "Content-Type: text/plain; charset=utf-8",
  ].filter((h): h is string => h !== null);

  // RFC 2822: blank line between headers and body
  const rawMessage = headerLines.join("\r\n") + "\r\n\r\n" + params.body;
  const encodedMessage = Buffer.from(rawMessage).toString("base64url");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId: params.threadId ?? undefined,
    },
  });
}
