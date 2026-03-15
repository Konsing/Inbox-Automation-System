# Gmail + Slack Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gmail reading, AI classification/summarization, Slack digest notifications, and reply-from-dashboard capabilities to the existing AI Inbox Automation System.

**Architecture:** Single Next.js app extended with Google OAuth for Gmail access, an SSE-streamed sync pipeline (async generator pattern matching existing demo), Slack Incoming Webhooks for digest posting, and a reply flow that sends emails via Gmail API. Tokens encrypted at rest in Supabase.

**Tech Stack:** Next.js 16 (App Router), Google OAuth + Gmail API (`googleapis`), Google Gemini Flash (`@google/genai`), Supabase (Postgres), Slack Incoming Webhooks, Tailwind + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-03-15-gmail-slack-integration-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/002_create_accounts_emails.sql` | Database migration for `accounts` and `emails` tables |
| `src/lib/crypto.ts` | AES-256-GCM token encryption/decryption |
| `src/lib/session.ts` | HMAC-SHA256 cookie signing, reading, clearing |
| `src/lib/gmail.ts` | Gmail API client factory, fetch emails, parse content, send replies |
| `src/lib/slack.ts` | Format Slack Block Kit digest, POST to webhook |
| `src/lib/sync-pipeline.ts` | Async generator for full sync flow |
| `src/lib/seed-emails.ts` | Fake email data for demo mode |
| `src/app/api/auth/google/route.ts` | GET → redirect to Google OAuth |
| `src/app/api/auth/google/callback/route.ts` | GET → handle OAuth callback |
| `src/app/api/auth/session/route.ts` | GET → check session, DELETE → disconnect |
| `src/app/api/sync/route.ts` | POST → SSE sync pipeline |
| `src/app/api/reply/route.ts` | POST → send reply via Gmail |
| `src/app/api/emails/route.ts` | GET → paginated, filtered email list |
| `src/app/dashboard/page.tsx` | Real dashboard page |
| `src/components/google-sign-in.tsx` | Sign in with Google button |
| `src/components/sync-controls.tsx` | Sync Now button + last sync time |
| `src/components/sync-visualizer.tsx` | Pipeline visualizer for sync steps |
| `src/components/email-card.tsx` | Email display with classification + reply |
| `src/components/email-list.tsx` | Filtered/sorted list of email cards |
| `src/components/reply-editor.tsx` | Editable draft reply textarea + send button |
| `src/hooks/use-session.ts` | Session state hook |
| `src/hooks/use-sync-stream.ts` | SSE consumer for sync pipeline |
| `src/hooks/use-emails.ts` | Fetch emails with filters |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `Account`, `Email`, `EmailClassification`, `SyncStep`, `SyncEvent` types |
| `src/lib/gemini.ts` | Add `classifyEmail()` and `generateEmailReply()` functions |
| `src/app/page.tsx` | Add "Dashboard" link to landing page |
| `src/app/demo/page.tsx` | Upgrade to use seed data + sync-style pipeline |
| `.env.example` | Add new environment variables |
| `package.json` | Add `googleapis` dependency |

---

## Chunk 1: Foundation (Database, Crypto, Session, Types)

### Task 1: Install dependency and update env

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1: Install googleapis**

```bash
npm install googleapis
```

- [ ] **Step 2: Update `.env.example` with new variables**

Add to `.env.example`:

```
# Google OAuth — Get these from Google Cloud Console > Credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Slack Incoming Webhook — Get from api.slack.com/apps > Incoming Webhooks
SLACK_WEBHOOK_URL=
DEMO_SLACK_WEBHOOK_URL=

# Session secret — generate with: openssl rand -hex 32
SESSION_SECRET=

# Site URL — used in Slack digest link (e.g. https://your-app.vercel.app)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 3: Update `.env.local` with placeholder values**

Add the same keys with placeholder values to `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Add googleapis dependency and new environment variables"
```

---

### Task 2: Database migration

**Files:**
- Create: `supabase/migrations/002_create_accounts_emails.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Accounts: stores Google OAuth tokens (encrypted)
CREATE TABLE accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  token_expiry    TIMESTAMPTZ NOT NULL,
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for service role" ON accounts
  FOR ALL USING (true) WITH CHECK (true);

-- Emails: stores fetched + classified emails
CREATE TABLE emails (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id       UUID REFERENCES accounts(id) ON DELETE CASCADE,
  gmail_id         TEXT NOT NULL UNIQUE,
  gmail_message_id TEXT,
  thread_id        TEXT,
  from_address     TEXT NOT NULL,
  from_name        TEXT,
  subject          TEXT NOT NULL,
  snippet          TEXT,
  body_text        TEXT,
  received_at      TIMESTAMPTZ NOT NULL,
  category         TEXT CHECK (category IN ('refund','billing','technical','general')),
  priority         TEXT CHECK (priority IN ('low','medium','high','urgent')),
  sentiment        TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  summary          TEXT,
  reply_deadline   TEXT,
  draft_reply      TEXT,
  reply_sent       BOOLEAN DEFAULT false,
  synced_at        TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_emails_account_synced ON emails (account_id, synced_at DESC);
CREATE INDEX idx_emails_gmail_id ON emails (gmail_id);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for service role" ON emails
  FOR ALL USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/002_create_accounts_emails.sql
git commit -m "Add database migration for accounts and emails tables"
```

---

### Task 3: TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add new types to the existing file**

Append to `src/lib/types.ts`:

```typescript
// --- Gmail + Slack Integration Types ---

export interface Account {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  account_id: string;
  gmail_id: string;
  gmail_message_id: string | null;
  thread_id: string | null;
  from_address: string;
  from_name: string | null;
  subject: string;
  snippet: string | null;
  body_text: string | null;
  received_at: string;
  category: Category | null;
  priority: Priority | null;
  sentiment: Sentiment | null;
  summary: string | null;
  reply_deadline: string | null;
  draft_reply: string | null;
  reply_sent: boolean;
  synced_at: string;
  updated_at: string;
}

export type ReplyDeadline =
  | "within 1 hour"
  | "within 4 hours"
  | "within 24 hours"
  | "within 48 hours";

export interface EmailClassification extends Classification {
  summary: string;
  reply_deadline: ReplyDeadline;
}

export type SyncStep =
  | "authenticating"
  | "fetching"
  | "classifying"
  | "drafting"
  | "storing"
  | "notifying"
  | "done"
  | "error";

export interface SyncEvent {
  step: SyncStep;
  detail: string;
  progress?: { current: number; total: number };
  stats?: { urgent: number; high: number; medium: number; low: number };
  error?: string;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "Add TypeScript types for accounts, emails, and sync pipeline"
```

---

### Task 4: Crypto utility

**Files:**
- Create: `src/lib/crypto.ts`

- [ ] **Step 1: Implement AES-256-GCM encryption/decryption**

```typescript
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey(process.env.SESSION_SECRET!);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${encrypted}:${tag.toString("base64")}`;
}

export function decryptToken(encrypted: string): string {
  const key = deriveKey(process.env.SESSION_SECRET!);
  const [ivB64, ciphertext, tagB64] = encrypted.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/crypto.ts
git commit -m "Add AES-256-GCM token encryption utility"
```

---

### Task 5: Session utility

**Files:**
- Create: `src/lib/session.ts`

- [ ] **Step 1: Implement cookie signing, reading, clearing**

```typescript
import { createHmac } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "inbox_session";
const MAX_AGE = 604800; // 7 days

function sign(value: string): string {
  const signature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(value)
    .digest("hex");
  return `${value}.${signature}`;
}

function verify(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;

  const value = signed.slice(0, lastDot);
  const expected = sign(value);

  if (expected !== signed) return null;
  return value;
}

export async function setSession(accountId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sign(accountId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return null;
  return verify(cookie.value);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function setOAuthState(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
}

export async function getOAuthState(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("oauth_state");
  if (!cookie) return null;
  return cookie.value;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.ts
git commit -m "Add session cookie signing and OAuth state utilities"
```

---

## Chunk 2: Google OAuth Routes

### Task 6: OAuth redirect route

**Files:**
- Create: `src/app/api/auth/google/route.ts`

- [ ] **Step 1: Implement the OAuth redirect**

```typescript
import { google } from "googleapis";
import { setOAuthState } from "@/lib/session";
import { randomBytes } from "crypto";

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  const state = randomBytes(32).toString("hex");
  await setOAuthState(state);

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });

  return Response.redirect(url);
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/google/route.ts
git commit -m "Add Google OAuth redirect route"
```

---

### Task 7: OAuth callback route

**Files:**
- Create: `src/app/api/auth/google/callback/route.ts`

- [ ] **Step 1: Implement the callback handler**

```typescript
import { NextRequest } from "next/server";
import { google } from "googleapis";
import { getSupabase } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";
import { setSession, getOAuthState } from "@/lib/session";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const baseUrl = request.nextUrl.origin;

  // Verify CSRF state
  const storedState = await getOAuthState();
  if (!state || !storedState || state !== storedState) {
    return Response.redirect(`${baseUrl}/dashboard?error=csrf_failed`);
  }

  if (!code) {
    return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
    }

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
    }

    // Encrypt tokens
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = encryptToken(tokens.refresh_token);
    const tokenExpiry = new Date(tokens.expiry_date ?? Date.now() + 3600000).toISOString();

    // Upsert account
    const supabase = getSupabase();
    const { data: account, error } = await supabase
      .from("accounts")
      .upsert(
        {
          email: userInfo.email,
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (error || !account) {
      return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
    }

    // Set session cookie
    await setSession(account.id);

    return Response.redirect(`${baseUrl}/dashboard`);
  } catch {
    return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/google/callback/route.ts
git commit -m "Add Google OAuth callback with CSRF protection and token encryption"
```

---

### Task 8: Session route (check + disconnect)

**Files:**
- Create: `src/app/api/auth/session/route.ts`

- [ ] **Step 1: Implement GET (check session) and DELETE (disconnect)**

```typescript
import { getSupabase } from "@/lib/supabase";
import { getSession, clearSession } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

export async function GET() {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ connected: false });
  }

  const supabase = getSupabase();
  const { data: account } = await supabase
    .from("accounts")
    .select("email")
    .eq("id", accountId)
    .single();

  if (!account) {
    await clearSession();
    return Response.json({ connected: false });
  }

  return Response.json({ connected: true, email: account.email });
}

export async function DELETE() {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ ok: true });
  }

  const supabase = getSupabase();

  // Try to revoke the Google token
  try {
    const { data: account } = await supabase
      .from("accounts")
      .select("access_token")
      .eq("id", accountId)
      .single();

    if (account) {
      const token = decryptToken(account.access_token);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: "POST",
      });
    }
  } catch {
    // Revocation is best-effort
  }

  // Delete account and clear session
  await supabase.from("accounts").delete().eq("id", accountId);
  await clearSession();

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/session/route.ts
git commit -m "Add session check and disconnect routes"
```

---

## Chunk 3: Gmail Client + AI Extensions

### Task 9: Gmail client library

**Files:**
- Create: `src/lib/gmail.ts`

- [ ] **Step 1: Implement Gmail client factory, email fetching, parsing, and reply sending**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/gmail.ts
git commit -m "Add Gmail client for fetching emails and sending replies"
```

---

### Task 10: Extend Gemini with email classification

**Files:**
- Modify: `src/lib/gemini.ts`

- [ ] **Step 1: Add `classifyEmail()` and `generateEmailReply()` functions**

Append to the existing `src/lib/gemini.ts` (do not modify existing functions).

First, update the existing import to include new types — change:
`import type { Classification, Category, Priority, Sentiment } from "./types";`
to:
`import type { Classification, Category, Priority, Sentiment, EmailClassification, ReplyDeadline } from "./types";`

Then append the following code after the existing `generateResponse` function:

```typescript

const VALID_DEADLINES: ReplyDeadline[] = [
  "within 1 hour",
  "within 4 hours",
  "within 24 hours",
  "within 48 hours",
];

export async function classifyEmail(
  subject: string,
  body: string,
  from: string
): Promise<EmailClassification> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are an email classifier. Analyze the following email and return a JSON object.

From: ${from}
Subject: ${subject}
Body: """${body.slice(0, 2000)}"""`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: VALID_CATEGORIES,
          },
          priority: {
            type: Type.STRING,
            enum: VALID_PRIORITIES,
          },
          sentiment: {
            type: Type.STRING,
            enum: VALID_SENTIMENTS,
          },
          summary: {
            type: Type.STRING,
            description: "One-line summary of the email, max 100 characters",
          },
          reply_deadline: {
            type: Type.STRING,
            description: "Suggested reply timeframe",
            enum: VALID_DEADLINES,
          },
        },
        required: ["category", "priority", "sentiment", "summary", "reply_deadline"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}");

  return {
    category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "general",
    priority: VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : "medium",
    sentiment: VALID_SENTIMENTS.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
    summary: (parsed.summary ?? "No summary available").slice(0, 100),
    reply_deadline: VALID_DEADLINES.includes(parsed.reply_deadline)
      ? parsed.reply_deadline
      : "within 24 hours",
  };
}

export async function generateEmailReply(
  from: string,
  subject: string,
  body: string,
  classification: EmailClassification
): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a professional email assistant. Write a helpful reply to this email.

From: ${from}
Subject: ${subject}
Body: """${body.slice(0, 2000)}"""

Classification:
- Category: ${classification.category}
- Priority: ${classification.priority}
- Sentiment: ${classification.sentiment}

Requirements:
- Professional and empathetic tone
- Address the specific issue
- Provide actionable next steps
- Keep it concise (2-3 paragraphs)
- Do not include a subject line, just the body`,
  });

  return response.text ?? "Thank you for your email. We will review and respond shortly.";
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "Add email classification and reply generation functions"
```

---

## Chunk 4: Slack + Sync Pipeline + API Routes

### Task 11: Slack digest utility

> **Spec deviation (intentional):** The spec mentions a separate "Batch Summary Generation" Gemini call for the Slack digest. This plan uses the per-email `summary` field from classification instead, avoiding an extra API call and staying well within rate limits. The per-email summaries are sufficient for the digest format.

**Files:**
- Create: `src/lib/slack.ts`

- [ ] **Step 1: Implement Slack Block Kit digest formatter and poster**

```typescript
import type { Email } from "./types";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text: string }>;
}

function priorityEmoji(priority: string): string {
  switch (priority) {
    case "urgent": return "🔴";
    case "high": return "🟠";
    case "medium": return "🟡";
    case "low": return "🟢";
    default: return "⚪";
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
        text: `🚨 *Urgent Emails (${urgent.length})*`,
      },
    });
    blocks.push({ type: "divider" });

    for (const email of urgent) {
      const name = email.from_name || email.from_address;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• *${name}* — ${email.summary ?? email.subject}\n  ⏰ ${email.reply_deadline ?? "Reply soon"} | 📂 ${email.category ?? "General"} | ${priorityEmoji(email.priority ?? "medium")} ${email.priority}`,
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
        text: `📬 *Other Emails (${other.length})*`,
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
        return `📂 *${cat.charAt(0).toUpperCase() + cat.slice(1)} (${items.length})* — ${summaries}`;
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
      text: `🔗 <${dashboardUrl}|View details & reply>`,
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/slack.ts
git commit -m "Add Slack Block Kit digest formatter and webhook poster"
```

---

### Task 12: Sync pipeline (async generator)

**Files:**
- Create: `src/lib/sync-pipeline.ts`

- [ ] **Step 1: Implement the full sync pipeline as an async generator**

```typescript
import { getSupabase } from "./supabase";
import { fetchUnreadEmails } from "./gmail";
import { classifyEmail, generateEmailReply } from "./gemini";
import { postSlackDigest } from "./slack";
import type { SyncEvent, Email, EmailClassification } from "./types";

async function classifyBatch(
  emails: Array<{ subject: string; body_text: string; from_address: string }>,
  batchSize: number
): Promise<EmailClassification[]> {
  const results: EmailClassification[] = [];
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((e) => classifyEmail(e.subject, e.body_text, e.from_address))
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

  // Step 3: Classify in parallel batches of 3
  yield { step: "classifying", detail: `Classifying ${rawEmails.length} emails...`, progress: { current: 0, total: rawEmails.length } };

  const classifications = await classifyBatch(
    rawEmails.map((e) => ({ subject: e.subject, body_text: e.body_text, from_address: e.from_address })),
    3
  );

  yield { step: "classifying", detail: `Classified ${rawEmails.length} emails`, progress: { current: rawEmails.length, total: rawEmails.length } };

  // Step 4: Generate drafts for urgent/high
  yield { step: "drafting", detail: "Generating draft replies for urgent emails..." };

  const drafts: (string | null)[] = [];
  for (let i = 0; i < rawEmails.length; i++) {
    const cls = classifications[i];
    if (cls.priority === "urgent" || cls.priority === "high") {
      const draft = await generateEmailReply(
        rawEmails[i].from_address,
        rawEmails[i].subject,
        rawEmails[i].body_text,
        cls
      );
      drafts.push(draft);
    } else {
      drafts.push(null);
    }
  }

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
    draft_reply: drafts[i],
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync-pipeline.ts
git commit -m "Add sync pipeline async generator with parallel classification"
```

---

### Task 13: Sync API route

**Files:**
- Create: `src/app/api/sync/route.ts`

- [ ] **Step 1: Implement SSE streaming sync endpoint**

```typescript
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { runSyncPipeline } from "@/lib/sync-pipeline";

function iteratorToStream(iterator: AsyncGenerator) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    cancel() {
      iterator.return(undefined);
    },
  });
}

export async function POST(request: NextRequest) {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const pipeline = runSyncPipeline(accountId);

  const sseGenerator = async function* () {
    try {
      for await (const event of pipeline) {
        const eventType = event.step === "error" ? "error" : "step";
        yield encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      yield encoder.encode(`event: complete\ndata: {}\n\n`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      yield encoder.encode(
        `event: error\ndata: ${JSON.stringify({ step: "error", detail: errorMessage, error: errorMessage })}\n\n`
      );
    }
  };

  const stream = iteratorToStream(sseGenerator());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/sync/route.ts
git commit -m "Add SSE streaming sync pipeline API route"
```

---

### Task 14: Reply API route

**Files:**
- Create: `src/app/api/reply/route.ts`

- [ ] **Step 1: Implement reply endpoint**

```typescript
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import { sendReply } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId, body } = await request.json();

  if (!emailId || !body?.trim()) {
    return Response.json({ error: "Email ID and reply body are required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Fetch the email
  const { data: email, error: emailError } = await supabase
    .from("emails")
    .select("*")
    .eq("id", emailId)
    .eq("account_id", accountId)
    .single();

  if (emailError || !email) {
    return Response.json({ error: "Email not found" }, { status: 404 });
  }

  // Fetch account email
  const { data: account } = await supabase
    .from("accounts")
    .select("email")
    .eq("id", accountId)
    .single();

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    await sendReply(accountId, {
      to: email.from_address,
      subject: email.subject,
      body: body.trim(),
      threadId: email.thread_id,
      inReplyTo: email.gmail_message_id,
      fromEmail: account.email,
    });

    // Mark as sent
    await supabase
      .from("emails")
      .update({ reply_sent: true, updated_at: new Date().toISOString() })
      .eq("id", emailId);

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send reply";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/reply/route.ts
git commit -m "Add reply API route for sending emails via Gmail"
```

---

### Task 15: Emails API route

**Files:**
- Create: `src/app/api/emails/route.ts`

- [ ] **Step 1: Implement paginated, filtered email list endpoint**

```typescript
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const offset = (page - 1) * limit;

  const supabase = getSupabase();
  let query = supabase
    .from("emails")
    .select("*", { count: "exact" })
    .eq("account_id", accountId)
    .order("received_at", { ascending: false });

  if (priority) query = query.eq("priority", priority);
  if (category) query = query.eq("category", category);

  const { data: emails, error, count } = await query.range(offset, offset + limit - 1);

  // Sort by priority weight (urgent first) since Supabase can't sort TEXT by custom order
  const priorityWeight: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sorted = (emails ?? []).sort(
    (a, b) => (priorityWeight[a.priority ?? "medium"] ?? 2) - (priorityWeight[b.priority ?? "medium"] ?? 2)
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    emails: sorted,
    total: count ?? 0,
    page,
    limit,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/emails/route.ts
git commit -m "Add paginated emails API route with priority and category filters"
```

---

## Chunk 5: Frontend — Hooks and Components

### Task 16: Session hook

**Files:**
- Create: `src/hooks/use-session.ts`

- [ ] **Step 1: Implement session state hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

interface SessionState {
  email: string | null;
  connected: boolean;
  isLoading: boolean;
  disconnect: () => Promise<void>;
  refetch: () => void;
}

export function useSession(): SessionState {
  const [email, setEmail] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!cancelled) {
          setConnected(data.connected);
          setEmail(data.email ?? null);
        }
      } catch {
        if (!cancelled) {
          setConnected(false);
          setEmail(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const disconnect = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setConnected(false);
    setEmail(null);
  }, []);

  return { email, connected, isLoading, disconnect, refetch };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-session.ts
git commit -m "Add session state hook for Google auth"
```

---

### Task 17: Sync stream hook

**Files:**
- Create: `src/hooks/use-sync-stream.ts`

- [ ] **Step 1: Implement SSE consumer hook for sync pipeline**

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import type { SyncStep, SyncEvent, PipelineStepStatus } from "@/lib/types";

export interface SyncPipelineStep {
  id: SyncStep;
  label: string;
  status: PipelineStepStatus;
  detail?: string;
}

const INITIAL_STEPS: SyncPipelineStep[] = [
  { id: "authenticating", label: "Authenticating", status: "waiting" },
  { id: "fetching", label: "Fetching", status: "waiting" },
  { id: "classifying", label: "Classifying", status: "waiting" },
  { id: "drafting", label: "Drafting", status: "waiting" },
  { id: "storing", label: "Storing", status: "waiting" },
  { id: "notifying", label: "Notifying", status: "waiting" },
  { id: "done", label: "Complete", status: "waiting" },
];

const STEP_ORDER: SyncStep[] = ["authenticating", "fetching", "classifying", "drafting", "storing", "notifying", "done"];

function updateStepStatuses(currentStepId: SyncStep, detail?: string): SyncPipelineStep[] {
  const currentIndex = STEP_ORDER.indexOf(currentStepId);
  return INITIAL_STEPS.map((step, i) => {
    let status: PipelineStepStatus;
    if (i < currentIndex) status = "complete";
    else if (i === currentIndex) status = "active";
    else status = "waiting";
    return { ...step, status, detail: i === currentIndex ? detail : step.detail };
  });
}

function parseSSEEvents(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const lines = text.split("\n");
  let currentEvent = "";
  let currentData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) currentEvent = line.slice(7);
    else if (line.startsWith("data: ")) currentData = line.slice(6);
    else if (line === "" && currentEvent) {
      events.push({ event: currentEvent, data: currentData });
      currentEvent = "";
      currentData = "";
    }
  }
  return events;
}

export function useSyncStream() {
  const [steps, setSteps] = useState<SyncPipelineStep[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startSync = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setLastEvent(null);
    setSteps(INITIAL_STEPS);

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Sync request failed");
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSEEvents(buffer);

        for (const evt of events) {
          if (evt.event === "step") {
            const data: SyncEvent = JSON.parse(evt.data);
            setLastEvent(data);
            setSteps(updateStepStatuses(data.step, data.detail));
          } else if (evt.event === "error") {
            const data = JSON.parse(evt.data);
            setError(data.error || data.detail || "Sync error");
            setSteps((prev) =>
              prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
            );
          }
        }

        const lastDoubleNewline = buffer.lastIndexOf("\n\n");
        if (lastDoubleNewline !== -1) {
          buffer = buffer.slice(lastDoubleNewline + 2);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSteps(INITIAL_STEPS);
    setIsRunning(false);
    setError(null);
    setLastEvent(null);
  }, []);

  return { steps, isRunning, error, lastEvent, startSync, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-sync-stream.ts
git commit -m "Add sync pipeline SSE consumer hook"
```

---

### Task 18: Emails hook

**Files:**
- Create: `src/hooks/use-emails.ts`

- [ ] **Step 1: Implement email fetch hook with filters**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Email } from "@/lib/types";

interface UseEmailsParams {
  priority?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface UseEmailsResult {
  emails: Email[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEmails(params: UseEmailsParams = {}): UseEmailsResult {
  const { priority, category, page = 1, limit = 20 } = params;
  const [emails, setEmails] = useState<Email[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchEmails() {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (priority) params.set("priority", priority);
      if (category) params.set("category", category);

      try {
        const res = await fetch(`/api/emails?${params}`);
        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) { setEmails([]); setTotal(0); }
            return;
          }
          throw new Error("Failed to fetch emails");
        }
        const data = await res.json();
        if (!cancelled) {
          setEmails(data.emails);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchEmails();
    return () => { cancelled = true; };
  }, [priority, category, page, limit, refreshKey]);

  return { emails, total, isLoading, error, refetch };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-emails.ts
git commit -m "Add emails fetch hook with filter and pagination support"
```

---

### Task 19: Google sign-in component

**Files:**
- Create: `src/components/google-sign-in.tsx`

- [ ] **Step 1: Implement sign-in button and connection status**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export function GoogleSignIn() {
  const { email, connected, isLoading, disconnect } = useSession();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking connection...
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm">
          Connected as <span className="font-medium">{email}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <a href="/api/auth/google">
      <Button>
        <LogIn className="mr-2 h-4 w-4" />
        Sign in with Google
      </Button>
    </a>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/google-sign-in.tsx
git commit -m "Add Google sign-in button and connection status component"
```

---

### Task 20: Sync controls and visualizer

**Files:**
- Create: `src/components/sync-controls.tsx`
- Create: `src/components/sync-visualizer.tsx`

- [ ] **Step 1: Implement sync controls**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

interface SyncControlsProps {
  onSync: () => void;
  isRunning: boolean;
  connected: boolean;
}

export function SyncControls({ onSync, isRunning, connected }: SyncControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button onClick={onSync} disabled={isRunning || !connected}>
        {isRunning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        {isRunning ? "Syncing..." : "Sync Now"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Implement sync visualizer**

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineStepNode } from "@/components/pipeline-step";
import type { SyncPipelineStep } from "@/hooks/use-sync-stream";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncVisualizerProps {
  steps: SyncPipelineStep[];
  isRunning: boolean;
  error: string | null;
}

export function SyncVisualizer({ steps, isRunning, error }: SyncVisualizerProps) {
  const hasStarted = steps.some((s) => s.status !== "waiting");

  if (!hasStarted) return null;

  return (
    <Card className={cn("transition-all duration-500", isRunning && "ring-2 ring-blue-500/20")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Sync Status
          {isRunning && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Processing...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-center overflow-x-auto py-2">
          {steps.map((step, i) => (
            <PipelineStepNode
              key={step.id}
              label={step.label}
              status={step.status}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sync-controls.tsx src/components/sync-visualizer.tsx
git commit -m "Add sync controls and sync pipeline visualizer components"
```

---

### Task 21: Reply editor and email card

**Files:**
- Create: `src/components/reply-editor.tsx`
- Create: `src/components/email-card.tsx`
- Create: `src/components/email-list.tsx`

- [ ] **Step 1: Implement reply editor**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Check } from "lucide-react";

interface ReplyEditorProps {
  emailId: string;
  draftReply: string | null;
  replySent: boolean;
  onSent: () => void;
  demoMode?: boolean;
}

export function ReplyEditor({ emailId, draftReply, replySent, onSent, demoMode }: ReplyEditorProps) {
  const [body, setBody] = useState(draftReply ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(replySent);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);

    try {
      if (demoMode) {
        await new Promise((r) => setTimeout(r, 500));
      } else {
        const res = await fetch("/api/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailId, body: body.trim() }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to send");
        }
      }
      setSent(true);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <Check className="h-4 w-4" />
        Reply sent
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write your reply..."
        className="resize-none text-sm"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button size="sm" onClick={handleSend} disabled={!body.trim() || sending}>
        {sending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
        {sending ? "Sending..." : "Send Reply"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Implement email card**

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge, PriorityBadge, SentimentBadge } from "@/components/classification-badge";
import { ReplyEditor } from "@/components/reply-editor";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import type { Email } from "@/lib/types";

interface EmailCardProps {
  email: Email;
  demoMode?: boolean;
  onReplySent?: () => void;
}

export function EmailCard({ email, demoMode, onReplySent }: EmailCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-2" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {email.from_name || email.from_address}
            </p>
            <p className="text-sm text-muted-foreground truncate">{email.subject}</p>
            {email.summary && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{email.summary}</p>
            )}
          </div>
          <button className="mt-0.5 shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {email.category && <CategoryBadge category={email.category} />}
          {email.priority && <PriorityBadge priority={email.priority} />}
          {email.sentiment && <SentimentBadge sentiment={email.sentiment} />}
          {email.reply_deadline && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {email.reply_deadline}
            </Badge>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="animate-in fade-in slide-in-from-top-1 space-y-3 pt-0 duration-200">
          {email.body_text && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Original Message</p>
              <p className="text-sm whitespace-pre-wrap line-clamp-6">{email.body_text}</p>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Draft Reply</p>
            <ReplyEditor
              emailId={email.id}
              draftReply={email.draft_reply}
              replySent={email.reply_sent}
              onSent={onReplySent ?? (() => {})}
              demoMode={demoMode}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Implement email list**

```typescript
"use client";

import { EmailCard } from "@/components/email-card";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Inbox } from "lucide-react";
import type { Email } from "@/lib/types";

interface EmailListProps {
  emails: Email[];
  isLoading: boolean;
  error: string | null;
  demoMode?: boolean;
  onReplySent?: () => void;
}

export function EmailList({ emails, isLoading, error, demoMode, onReplySent }: EmailListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-red-500">
          Failed to load emails: {error}
        </CardContent>
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No emails yet. Click &quot;Sync Now&quot; to fetch your inbox.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {emails.map((email) => (
        <EmailCard key={email.id} email={email} demoMode={demoMode} onReplySent={onReplySent} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/reply-editor.tsx src/components/email-card.tsx src/components/email-list.tsx
git commit -m "Add reply editor, email card, and email list components"
```

---

## Chunk 6: Dashboard, Demo Upgrade, Landing Page, Polish

### Task 22: Dashboard page

**Files:**
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Assemble the dashboard**

```typescript
"use client";

import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { GoogleSignIn } from "@/components/google-sign-in";
import { SyncControls } from "@/components/sync-controls";
import { SyncVisualizer } from "@/components/sync-visualizer";
import { EmailList } from "@/components/email-list";
import { useSession } from "@/hooks/use-session";
import { useSyncStream } from "@/hooks/use-sync-stream";
import { useEmails } from "@/hooks/use-emails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail } from "lucide-react";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const { connected, isLoading: sessionLoading } = useSession();
  const { steps, isRunning, error: syncError, startSync } = useSyncStream();
  const { emails, isLoading: emailsLoading, error: emailsError, refetch } = useEmails();

  const handleSync = useCallback(async () => {
    await startSync();
    refetch();
  }, [startSync, refetch]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto space-y-6 px-4 py-6">
        {/* Auth Error Banner */}
        {authError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {authError === "csrf_failed"
              ? "Authentication failed (CSRF mismatch). Please try again."
              : "Authentication failed. Please try again."}
          </div>
        )}

        {/* Connection + Sync Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Gmail Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <GoogleSignIn />
            {connected && <SyncControls onSync={handleSync} isRunning={isRunning} connected={connected} />}
          </CardContent>
        </Card>

        {/* Sync Visualizer */}
        <SyncVisualizer steps={steps} isRunning={isRunning} error={syncError} />

        <Separator />

        {/* Email List */}
        {connected && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Inbox</h2>
            <EmailList
              emails={emails}
              isLoading={emailsLoading}
              error={emailsError}
              onReplySent={refetch}
            />
          </div>
        )}

        {!connected && !sessionLoading && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Mail className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Sign in with Google to connect your inbox.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "Add dashboard page with Gmail connection, sync, and email list"
```

---

### Task 23: Seed emails for demo mode

**Files:**
- Create: `src/lib/seed-emails.ts`

- [ ] **Step 1: Create seed email data**

```typescript
import type { Email } from "./types";

// Seed data mimics the shape of Email rows without real IDs
export interface SeedEmail {
  from_address: string;
  from_name: string;
  subject: string;
  body_text: string;
}

export const SEED_EMAILS: SeedEmail[] = [
  {
    from_address: "john.smith@example.com",
    from_name: "John Smith",
    subject: "Refund not processed - it's been 2 weeks!",
    body_text: "I requested a refund for order #4892 over two weeks ago and still haven't received it. This is completely unacceptable. I've been a loyal customer for 3 years and this is how I'm treated? I need this resolved immediately or I'm disputing the charge with my bank.",
  },
  {
    from_address: "sarah.lee@example.com",
    from_name: "Sarah Lee",
    subject: "URGENT: Can't access my account - locked out",
    body_text: "My account has been locked and I can't access the dashboard at all. I've tried resetting my password three times but keep getting an error. I have a critical deadline today and need access to my files immediately. Please help ASAP.",
  },
  {
    from_address: "mike.chen@example.com",
    from_name: "Mike Chen",
    subject: "Charged twice for my subscription",
    body_text: "I noticed two charges of $29.99 on my credit card statement this month for my subscription. I should only be charged once. Can you please look into this and refund the duplicate charge? My account email is mike.chen@example.com.",
  },
  {
    from_address: "emma.wilson@example.com",
    from_name: "Emma Wilson",
    subject: "When will my order ship?",
    body_text: "Hi, I placed order #7721 three days ago and the status still shows 'processing'. Could you let me know when it's expected to ship? I need it by next Friday for an event. Thanks!",
  },
  {
    from_address: "alex.rivera@example.com",
    from_name: "Alex Rivera",
    subject: "Thank you for the amazing support!",
    body_text: "I just wanted to say thank you to your support team, especially Jessica who helped me last week. She went above and beyond to resolve my issue and I really appreciate it. Keep up the great work!",
  },
  {
    from_address: "priya.patel@example.com",
    from_name: "Priya Patel",
    subject: "Feature request: Dark mode for the dashboard",
    body_text: "I use your dashboard daily and would love to see a dark mode option. Working late at night with the bright white interface is tough on the eyes. I know other users have requested this too. Any plans to add it?",
  },
  {
    from_address: "david.kim@example.com",
    from_name: "David Kim",
    subject: "Question about my invoice",
    body_text: "Hi, I received invoice #INV-2024-0892 but the amount doesn't match what I expected based on our agreement. Could someone review this? I believe the discount we discussed wasn't applied. My account number is DK-44821.",
  },
  {
    from_address: "lisa.thompson@example.com",
    from_name: "Lisa Thompson",
    subject: "Partnership inquiry - Integration opportunity",
    body_text: "Hi there, I'm the Head of Partnerships at TechFlow Inc. We're interested in exploring an integration between our platforms. I think there's a great opportunity for both our user bases. Would someone from your team be available for a call next week to discuss?",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/seed-emails.ts
git commit -m "Add seed email data for demo mode"
```

---

### Task 24: Upgrade demo page with seed data and sync-style pipeline

**Files:**
- Modify: `src/app/demo/page.tsx`

- [ ] **Step 1: Upgrade the demo page to use seed emails through the sync-style visualizer**

The demo page should:
1. Keep the existing password gate
2. Replace the manual message input with a "Run Demo Sync" button
3. Use seed emails from `src/lib/seed-emails.ts` instead of real Gmail
4. Run each seed email through the existing `classifyMessage()` + `generateResponse()` from gemini.ts
5. Display results using the new `SyncVisualizer`, `EmailList`, `EmailCard`, and `ReplyEditor` components
6. Mock the Slack step (show as complete without actually posting, unless `DEMO_SLACK_WEBHOOK_URL` is set)
7. Reply sends should be simulated (delay, no actual Gmail send) via the `demoMode` prop on `ReplyEditor`

Key changes to `src/app/demo/page.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { PasswordGate } from "@/components/password-gate";
import { Header } from "@/components/header";
import { SyncVisualizer } from "@/components/sync-visualizer";
import { EmailList } from "@/components/email-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineStepNode } from "@/components/pipeline-step";
import { Play, Loader2, Info } from "lucide-react";
import { SEED_EMAILS } from "@/lib/seed-emails";
import type { Email, SyncStep, PipelineStepStatus } from "@/lib/types";

interface DemoStep {
  id: SyncStep;
  label: string;
  status: PipelineStepStatus;
}

const INITIAL_STEPS: DemoStep[] = [
  { id: "authenticating", label: "Authenticating", status: "waiting" },
  { id: "fetching", label: "Fetching", status: "waiting" },
  { id: "classifying", label: "Classifying", status: "waiting" },
  { id: "drafting", label: "Drafting", status: "waiting" },
  { id: "storing", label: "Storing", status: "waiting" },
  { id: "notifying", label: "Notifying", status: "waiting" },
  { id: "done", label: "Complete", status: "waiting" },
];

function DemoContent() {
  const [steps, setSteps] = useState<DemoStep[]>(INITIAL_STEPS);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStep = (stepId: SyncStep, status: PipelineStepStatus) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === stepId) return { ...s, status };
        const stepOrder = INITIAL_STEPS.map((s) => s.id);
        const targetIdx = stepOrder.indexOf(stepId);
        const currentIdx = stepOrder.indexOf(s.id);
        if (currentIdx < targetIdx) return { ...s, status: "complete" };
        return s;
      })
    );
  };

  const runDemoSync = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setEmails([]);
    setSteps(INITIAL_STEPS);

    try {
      // Simulate authenticating
      updateStep("authenticating", "active");
      await new Promise((r) => setTimeout(r, 500));
      updateStep("authenticating", "complete");

      // Simulate fetching
      updateStep("fetching", "active");
      await new Promise((r) => setTimeout(r, 800));
      updateStep("fetching", "complete");

      // Classify seed emails via real API (reuses demo pipeline)
      updateStep("classifying", "active");
      const classifiedEmails: Email[] = [];

      for (const seed of SEED_EMAILS) {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: `From: ${seed.from_name} <${seed.from_address}>\nSubject: ${seed.subject}\n\n${seed.body_text}` }),
        });

        // Read SSE to extract classification
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let result = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
        }

        // Parse last ticket state from SSE
        const dataMatches = [...result.matchAll(/data: ({.*})/g)];
        const lastData = dataMatches[dataMatches.length - 1];
        if (lastData) {
          const parsed = JSON.parse(lastData[1]);
          if (parsed.ticket) {
            classifiedEmails.push({
              id: parsed.ticket.id ?? crypto.randomUUID(),
              account_id: "demo",
              gmail_id: `demo-${crypto.randomUUID()}`,
              gmail_message_id: null,
              thread_id: null,
              from_address: seed.from_address,
              from_name: seed.from_name,
              subject: seed.subject,
              snippet: seed.body_text.slice(0, 100),
              body_text: seed.body_text,
              received_at: new Date().toISOString(),
              category: parsed.ticket.category,
              priority: parsed.ticket.priority,
              sentiment: parsed.ticket.sentiment,
              summary: seed.subject,
              reply_deadline: null,
              draft_reply: parsed.ticket.ai_response,
              reply_sent: false,
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      updateStep("classifying", "complete");

      // Drafting (already done via pipeline)
      updateStep("drafting", "active");
      await new Promise((r) => setTimeout(r, 300));
      updateStep("drafting", "complete");

      // Storing (simulated)
      updateStep("storing", "active");
      await new Promise((r) => setTimeout(r, 400));
      updateStep("storing", "complete");

      // Notifying (simulated Slack)
      updateStep("notifying", "active");
      await new Promise((r) => setTimeout(r, 300));
      updateStep("notifying", "complete");

      // Done
      updateStep("done", "active");
      setEmails(classifiedEmails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sync failed");
    } finally {
      setIsRunning(false);
    }
  }, []);

  const hasStarted = steps.some((s) => s.status !== "waiting");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto space-y-6 px-4 py-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Demo mode — uses sample emails to demonstrate the AI classification and reply pipeline.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Demo Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={runDemoSync} disabled={isRunning}>
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {isRunning ? "Running..." : "Run Demo Sync"}
            </Button>
          </CardContent>
        </Card>

        {hasStarted && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sync Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-center overflow-x-auto py-2">
                {steps.map((step, i) => (
                  <PipelineStepNode
                    key={step.id}
                    label={step.label}
                    status={step.status}
                    isLast={i === steps.length - 1}
                  />
                ))}
              </div>
              {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {emails.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Classified Emails</h2>
            <EmailList
              emails={emails}
              isLoading={false}
              error={null}
              demoMode={true}
              onReplySent={() => {}}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function DemoPage() {
  return (
    <PasswordGate>
      <DemoContent />
    </PasswordGate>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/demo/page.tsx
git commit -m "Upgrade demo page with seed data and sync-style pipeline visualization"
```

---

### Task 25: Update landing page with dashboard link

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add "Dashboard" button next to "Try the Demo" on the landing page**

In `src/app/page.tsx`, in the hero button section, add a second link:

```tsx
<Link href="/dashboard">
  <Button variant="outline" size="lg">
    <Mail className="mr-2 h-4 w-4" />
    Dashboard
  </Button>
</Link>
```

Add `Mail` to the existing lucide-react imports.

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "Add dashboard link to landing page"
```

---

### Task 26: Update .env.example and build verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Ensure all new env vars are documented in .env.example** (may already be done in Task 1, verify)

- [ ] **Step 2: Run full type check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: clean compile, all routes show in build output including `/dashboard`, `/api/sync`, `/api/reply`, `/api/emails`, `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/session`.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "Gmail + Slack integration: complete implementation"
git push -u origin main
```

---

## Post-Implementation Checklist

- [ ] Run the Supabase migration (`002_create_accounts_emails.sql`) in your Supabase SQL editor
- [ ] Set up Google Cloud OAuth credentials and add redirect URIs
- [ ] Set up Slack Incoming Webhook
- [ ] Fill in all new env vars in `.env.local`
- [ ] Test locally: sign in with Google → sync → see Slack digest → send reply
- [ ] Set env vars in Vercel dashboard
- [ ] Update `GOOGLE_REDIRECT_URI` for production URL
- [ ] Deploy to Vercel and test end-to-end
