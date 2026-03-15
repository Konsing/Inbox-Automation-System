# Gmail + Slack Integration Design

## Overview

Extend the AI Inbox Automation System to read real emails from Gmail, classify and summarize them with AI, post a digest to Slack, and allow editing/sending AI-drafted replies — all from a web dashboard. The hosted `/demo` page uses seed data to demonstrate the full flow without connecting a real inbox.

## Architecture

Single Next.js app (existing). All Gmail/Slack operations happen server-side in API routes. Google OAuth tokens are encrypted and stored in Supabase. The existing async generator + SSE streaming pattern is reused for the sync pipeline.

```
Dashboard (Vercel)
    |
    |-- GET  /api/auth/google           → Redirect to Google consent screen
    |-- GET  /api/auth/google/callback   → Exchange code, store tokens, set cookie
    |-- GET  /api/auth/session           → Check current session
    |-- DELETE /api/auth/session          → Disconnect / sign out
    |-- POST /api/sync (SSE)             → Read Gmail → Classify → Summarize → Slack → Stream
    |-- POST /api/reply                  → Send reply via Gmail API
    |-- GET  /api/emails                 → Fetch classified emails
    |
    |-- Existing routes unchanged:
    |   POST /api/pipeline (demo)
    |   GET  /api/tickets  (demo)
    |   POST /api/auth     (demo password)
```

External services:
- **Google OAuth + Gmail API** — read inbox, send replies
- **Slack Incoming Webhook** — post digest messages
- **Google Gemini Flash** — classification, summarization, draft replies
- **Supabase** — store accounts, emails, classifications

## Google OAuth Flow

### Setup (one-time, in Google Cloud Console)

1. Create OAuth 2.0 credentials (Web application)
2. Set authorized redirect URI: `https://your-app.vercel.app/api/auth/google/callback`
3. Enable Gmail API in the project
4. Scopes requested:
   - `https://www.googleapis.com/auth/gmail.readonly` — read emails
   - `https://www.googleapis.com/auth/gmail.send` — send replies
   - `https://www.googleapis.com/auth/userinfo.email` — identify user

### Flow

1. User clicks "Sign in with Google" on the dashboard
2. `GET /api/auth/google` generates an OAuth URL with `access_type: 'offline'` and `prompt: 'consent'` (ensures refresh token is always returned), generates a random `state` parameter, stores it in a short-lived httpOnly cookie (`oauth_state`, 10 min expiry), and redirects the browser
3. User consents on Google's page
4. Google redirects to `GET /api/auth/google/callback?code=xxx&state=yyy`
5. Callback handler verifies `state` matches the cookie value (CSRF protection), then exchanges the code for `access_token` + `refresh_token`
6. Encrypts tokens with AES-256-GCM using `SESSION_SECRET` before storing in `accounts` table
7. Sets a signed, httpOnly session cookie (`inbox_session`) with the account ID
8. Redirects to `/dashboard`

### CSRF Protection

The `state` parameter prevents CSRF attacks on the OAuth callback. Without it, an attacker could trick a user into connecting a different Google account. The state is a random string stored in a short-lived cookie and verified on callback.

### Token Storage Security

Tokens are encrypted at rest using AES-256-GCM with `SESSION_SECRET` as the key derivation input. The encryption/decryption happens in a `src/lib/crypto.ts` utility:
- `encryptToken(plaintext: string): string` — returns `iv:ciphertext:tag` base64 string
- `decryptToken(encrypted: string): string` — reverses the process

This ensures that even if the Supabase database is compromised, tokens are not usable without the `SESSION_SECRET`.

### Token Refresh

Before any Gmail API call, decrypt the stored tokens, check if `token_expiry` has passed. If so, use the `refresh_token` to get a new `access_token`, encrypt the new token, and update the `accounts` row.

### Session Cookie

- **Name**: `inbox_session`
- **Value**: HMAC-SHA256 signed account ID using `SESSION_SECRET`
- **Attributes**: `httpOnly`, `Secure` (in production), `SameSite=Lax`, `Path=/`, `Max-Age=604800` (7 days)
- **Signing**: The cookie value is `accountId.signature` where signature = HMAC-SHA256(accountId, SESSION_SECRET). On read, verify the signature before trusting the account ID.

### Session Check

`GET /api/auth/session` reads the cookie, verifies the signature, looks up the account, and returns `{ email, connected: true }` or `{ connected: false }`. The dashboard uses this to show connection state.

### Disconnect

`DELETE /api/auth/session` clears the session cookie, optionally revokes the Google token via `https://oauth2.googleapis.com/revoke?token=ACCESS_TOKEN`, and deletes the `accounts` row from Supabase. This handles both user-initiated disconnect and recovery from token revocation on Google's side.

## New Environment Variables

```
GOOGLE_CLIENT_ID=           # OAuth client ID from Google Cloud Console
GOOGLE_CLIENT_SECRET=       # OAuth client secret
GOOGLE_REDIRECT_URI=        # e.g. https://your-app.vercel.app/api/auth/google/callback
SLACK_WEBHOOK_URL=           # Slack Incoming Webhook URL
SESSION_SECRET=              # 32+ char random string for cookie signing + token encryption
```

## Database Schema Changes

### New table: `accounts`

```sql
CREATE TABLE accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  access_token    TEXT NOT NULL,      -- AES-256-GCM encrypted
  refresh_token   TEXT NOT NULL,      -- AES-256-GCM encrypted
  token_expiry    TIMESTAMPTZ NOT NULL,
  last_sync_at    TIMESTAMPTZ,        -- prevents concurrent syncs
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for service role" ON accounts
  FOR ALL USING (true) WITH CHECK (true);
```

### New table: `emails`

```sql
CREATE TABLE emails (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id       UUID REFERENCES accounts(id) ON DELETE CASCADE,
  gmail_id         TEXT NOT NULL UNIQUE,
  gmail_message_id TEXT,               -- RFC 2822 Message-ID header (for threading replies)
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
  reply_deadline   TEXT,               -- e.g. "within 1 hour", "within 24 hours"
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

### Existing table: `tickets` — unchanged

The `tickets` table remains as-is for the demo pipeline.

## New TypeScript Types

```typescript
// Account (stored in Supabase, tokens encrypted)
interface Account {
  id: string;
  email: string;
  access_token: string;   // encrypted
  refresh_token: string;  // encrypted
  token_expiry: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

// Email (stored in Supabase)
interface Email {
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

// Extended classification (adds summary + deadline to existing Classification)
interface EmailClassification extends Classification {
  summary: string;
  reply_deadline: string;
}

// Sync pipeline events
type SyncStep = "authenticating" | "fetching" | "classifying" | "drafting" | "storing" | "notifying" | "done" | "error";

interface SyncEvent {
  step: SyncStep;
  detail: string;
  progress?: { current: number; total: number };
  stats?: { urgent: number; high: number; medium: number; low: number };
  error?: string;
}

// Reuses existing: Category, Priority, Sentiment, Classification, PipelineStepStatus
```

## Sync Pipeline (`POST /api/sync`)

### Trigger

Manual — user clicks "Sync Now" on the dashboard. Returns an SSE stream.

### Vercel Timeout Constraint

Vercel free tier allows 25 seconds per function invocation. To stay within this:
- **Max 10 emails per sync** (not 20) — reduces total API calls
- **Parallel classification** — Gemini calls run in batches of 3 via `Promise.all` with concurrency limit, not sequentially
- **Draft generation only for urgent/high** — limits the number of extra Gemini calls
- Expected timing: auth (~0.5s) + fetch 10 emails (~2s) + classify 10 in batches of 3 (~6s) + draft 2-3 urgent (~3s) + store (~0.5s) + Slack (~0.5s) = ~12.5s total, well within 25s

### Concurrent Sync Prevention

Before starting, check `accounts.last_sync_at`. If it was within the last 30 seconds, return a 429 error. On sync start, update `last_sync_at` to `now()`. The frontend also disables the button while `isRunning` (matching existing `use-pipeline-stream` pattern).

### Steps (async generator)

1. **Authenticate** — Read session cookie, fetch account, decrypt tokens, refresh if expired. Yield `"authenticating"`.
2. **Fetch emails** — `gmail.users.messages.list` (query: `is:unread`, max 10). For each message ID, `gmail.users.messages.get` to fetch full content. Extract from, subject, snippet, body (prefer text/plain part), Message-ID header. Yield `"fetching"` with count.
3. **Classify** — Classify emails in parallel batches of 3. Each returns: category, priority, sentiment, summary, reply_deadline. Yield `"classifying"` with progress.
4. **Generate drafts** — For urgent/high priority emails only, generate AI draft replies. Yield `"drafting"`.
5. **Store** — Upsert all emails into the `emails` table (upsert on `gmail_id` to avoid duplicates). Yield `"storing"`.
6. **Slack digest** — Format and POST the digest message to the Slack webhook. Yield `"notifying"`.
7. **Complete** — Yield `"done"` with summary stats.

### SSE Events

Same format as existing pipeline:

```
event: step
data: {"step":"fetching","detail":"Found 8 unread emails","progress":{"current":0,"total":8}}

event: step
data: {"step":"classifying","detail":"Classifying email 3 of 8","progress":{"current":3,"total":8}}

event: step
data: {"step":"done","detail":"Sync complete: 2 urgent, 6 other","stats":{"urgent":2,"high":1,"medium":3,"low":2}}

event: complete
data: {}
```

### Gmail API Details

**List unread messages:**
```
gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread',
  maxResults: 10
})
```

**Get message content:**
```
gmail.users.messages.get({
  userId: 'me',
  id: messageId,
  format: 'full'
})
```

Parse headers for From, Subject, Date, Message-ID. Extract body from `payload.parts` (prefer `text/plain`, fall back to `text/html` stripped of tags).

## AI Integration Changes

### Extended Classification Schema

A new `classifyEmail` function (separate from existing `classifyMessage` to avoid breaking the demo) with additional fields:

```json
{
  "category": "refund",
  "priority": "urgent",
  "sentiment": "negative",
  "summary": "Customer demands refund for defective product after 2 weeks of no response",
  "reply_deadline": "within 1 hour"
}
```

The `reply_deadline` is constrained to an enum in the JSON schema: `["within 1 hour", "within 4 hours", "within 24 hours", "within 48 hours"]`. The AI chooses based on urgency, sentiment, and content.

### Draft Reply Generation

Same approach as existing `generateResponse`, but with email context:

```
You are a professional email assistant. Write a helpful reply to this email.

From: ${from}
Subject: ${subject}
Body: ${body}

Classification:
- Category: ${category}
- Priority: ${priority}
- Sentiment: ${sentiment}

Requirements:
- Professional and empathetic tone
- Address the specific issue
- Provide actionable next steps
- Keep it concise (2-3 paragraphs)
- Do not include a subject line, just the body
```

### Batch Summary Generation

After all emails are classified, a separate Gemini call generates the Slack digest summary:

```
You are an email digest assistant. Summarize these emails for a Slack notification.

Emails:
${JSON.stringify(classifiedEmails)}

Format your response as JSON:
{
  "urgent_summary": "Brief overview of urgent items",
  "other_summary": "Brief overview of non-urgent items grouped by category"
}
```

## `GET /api/emails` Endpoint

### Request

Query parameters:
- `priority` (optional) — filter by priority: `urgent`, `high`, `medium`, `low`
- `category` (optional) — filter by category: `refund`, `billing`, `technical`, `general`
- `page` (optional, default `1`) — pagination
- `limit` (optional, default `20`, max `50`) — items per page

Requires valid `inbox_session` cookie.

### Response

```json
{
  "emails": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

Sorted by `received_at DESC` (newest first) with urgent/high priority emails first within each page. Only returns emails for the authenticated account.

## Slack Digest

### Setup

User creates a Slack Incoming Webhook in their workspace:
1. Go to api.slack.com/apps → Create New App → From scratch
2. Incoming Webhooks → Activate → Add New Webhook to Workspace
3. Choose a channel → Copy the webhook URL
4. Set `SLACK_WEBHOOK_URL` in environment variables

### Message Format

Uses Slack Block Kit (structured JSON). Posted via `fetch()` POST to the webhook URL.

```
🚨 *Urgent Emails (3)*
━━━━━━━━━━━━━━━━━━━━
• *John Smith* — Refund not processed after 2 weeks
  ⏰ Reply within 1 hour | 📂 Refund | 🔴 Urgent

• *Sarah Lee* — Account locked, can't access dashboard
  ⏰ Reply within 2 hours | 📂 Technical | 🔴 Urgent

━━━━━━━━━━━━━━━━━━━━
📬 *Other Emails (5)*

📂 *General (3)* — Meeting follow-ups, partnership inquiry
📂 *Billing (1)* — Payment confirmation question
📂 *Technical (1)* — Feature request for dark mode

━━━━━━━━━━━━━━━━━━━━
🔗 View details & reply: https://your-app.vercel.app/dashboard
```

### Implementation

Simple `fetch()` POST — no Slack SDK needed:

```typescript
await fetch(process.env.SLACK_WEBHOOK_URL!, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blocks: [...] }),
});
```

## Reply Flow (`POST /api/reply`)

### Request

```json
{
  "emailId": "uuid",
  "body": "Dear John, I apologize for the delay..."
}
```

Requires valid `inbox_session` cookie.

### Steps

1. Read session cookie, verify authenticated
2. Fetch email row from Supabase (get `gmail_id`, `gmail_message_id`, `thread_id`, `from_address`, `subject`)
3. Fetch account tokens, decrypt, refresh if needed
4. Construct RFC 2822 email with proper threading headers:
   - `To` — original sender's address
   - `Subject` — "Re: " + original subject
   - `In-Reply-To` — `gmail_message_id` (the RFC 2822 Message-ID from the original email)
   - `References` — `gmail_message_id`
5. Call `gmail.users.messages.send()` with the base64url-encoded email and `threadId`
6. Update email row: `reply_sent = true`
7. Return success

### Gmail Send Format

Gmail API expects a base64url-encoded RFC 2822 email:

```
From: user@gmail.com
To: sender@example.com
Subject: Re: Original Subject
In-Reply-To: <original-message-id@mail.gmail.com>
References: <original-message-id@mail.gmail.com>
Content-Type: text/plain; charset=utf-8

Reply body here
```

## Demo Mode (`/demo`)

### Seed Data

8 fake emails covering all categories and priorities:

1. Angry refund request (urgent, negative) — refund
2. Account locked (urgent, negative) — technical
3. Double charged (high, negative) — billing
4. Shipping delay question (medium, neutral) — general
5. Thank you note (low, positive) — general
6. Feature request (medium, neutral) — technical
7. Invoice question (medium, neutral) — billing
8. Partnership inquiry (low, positive) — general

### Demo Flow

1. User clicks "Run Demo Sync" (password-gated)
2. Seed emails are loaded (no Gmail API call)
3. Real AI pipeline classifies and generates drafts for each
4. Slack digest is posted only if `DEMO_SLACK_WEBHOOK_URL` is set (separate from production webhook to avoid polluting real channels); otherwise the Slack step is shown as "simulated" in the visualizer
5. Dashboard shows classified emails with editable draft replies
6. "Send Reply" shows a success toast but doesn't actually send (mock)

### Reuse

The demo uses the same components, hooks, and AI functions as the real dashboard. Only the data source differs (seed array vs Gmail API) and the reply send is mocked.

## Frontend — Route Structure

```
src/app/
├── page.tsx                          # Landing page (existing, updated with dashboard link)
├── demo/page.tsx                     # Password-gated demo with seed data (existing, upgraded)
├── dashboard/page.tsx                # Real dashboard (requires Google sign-in)
├── api/
│   ├── auth/
│   │   ├── route.ts                  # Demo password (existing)
│   │   ├── google/route.ts           # Redirect to Google OAuth
│   │   ├── google/callback/route.ts  # Handle OAuth callback
│   │   └── session/route.ts          # GET check session / DELETE disconnect
│   ├── sync/route.ts                 # SSE sync pipeline
│   ├── reply/route.ts                # Send reply via Gmail
│   ├── emails/route.ts               # GET emails for dashboard
│   ├── pipeline/route.ts             # Demo pipeline (existing)
│   └── tickets/route.ts              # Demo tickets (existing)
```

## Frontend — Dashboard Page

The `/dashboard` page has these sections:

1. **Connection status bar** — "Connected as user@gmail.com" with "Disconnect" link, or "Sign in with Google" button
2. **Sync controls** — "Sync Now" button + last sync timestamp
3. **Sync pipeline visualizer** — Reuses `pipeline-visualizer` pattern but with sync steps (authenticating → fetching → classifying → drafting → storing → notifying → done)
4. **Email list** — Cards showing each email with:
   - From, subject, snippet
   - Classification badges (reusing existing component)
   - Reply deadline badge
   - Expandable AI draft reply (editable textarea)
   - "Send Reply" button
5. **Filter/sort** — Filter by priority (urgent first by default), category

## Frontend — New Components

- `google-sign-in.tsx` — "Sign in with Google" button, checks session on mount
- `sync-controls.tsx` — "Sync Now" button with loading state, disabled while running or within 30s of last sync
- `sync-visualizer.tsx` — Pipeline visualizer adapted for sync steps
- `email-card.tsx` — Email display with classification, draft reply, send button
- `email-list.tsx` — Filtered/sorted list of email cards
- `reply-editor.tsx` — Textarea with the AI draft, edit and send functionality

## Frontend — New Hooks

- `use-session.ts` — Checks `GET /api/auth/session`, returns `{ email, connected, isLoading }`, exposes `disconnect()` method
- `use-sync-stream.ts` — Like `use-pipeline-stream` but for `/api/sync` (SSE consumer for sync steps)
- `use-emails.ts` — Fetches emails from `GET /api/emails` with filter/pagination params, exposes `refetch()`

## New Dependencies

```
googleapis          — Google OAuth + Gmail API client
```

Note: The project already uses `@google/genai` for Gemini. `googleapis` is a separate, larger package for the Gmail API + OAuth. Both are needed.

Slack webhook is just a `fetch()` POST. No SDK needed.

## Error Handling

- **OAuth failure** — Redirect to dashboard with `?error=auth_failed` query param, show error banner
- **CSRF mismatch** — Redirect to dashboard with `?error=csrf_failed`, prompt retry
- **Token refresh failure** — Clear session cookie, delete account row, prompt re-authentication
- **Token revocation (Google-side)** — Detected when Gmail API returns 401; handle same as refresh failure
- **Gmail API rate limit** — Catch 429, show "Rate limited, try again in a minute" in SSE stream
- **Gemini failure** — Yield error event for that email, skip classification, continue with remaining emails
- **Slack webhook failure** — Log error, still complete sync (Slack is non-critical)
- **Reply send failure** — Return error to frontend, show toast
- **Concurrent sync** — Return 429 if `last_sync_at` is within 30 seconds

## Implementation Order

### Phase 1: Google OAuth + Database
- Add `googleapis` dependency
- Create `src/lib/crypto.ts` — token encryption/decryption utilities
- Create migration `002_create_accounts_emails.sql`
- Build OAuth routes (`/api/auth/google`, `/api/auth/google/callback`)
- Build session routes (`GET /api/auth/session`, `DELETE /api/auth/session`)
- Build `google-sign-in` component and `use-session` hook
- Build `/dashboard` page with connection status

### Phase 2: Sync Pipeline
- Build `src/lib/gmail.ts` — Gmail client factory, fetch emails, parse content
- Build `src/lib/gemini.ts` extensions — `classifyEmail()` with summary + deadline
- Build `src/lib/sync-pipeline.ts` — async generator for full sync flow
- Build `POST /api/sync` — SSE streaming route
- Build `use-sync-stream` hook and `sync-visualizer` component
- Build sync controls on dashboard

### Phase 3: Slack Digest
- Build `src/lib/slack.ts` — format Block Kit digest, POST to webhook
- Integrate into sync pipeline (step 6)
- Test with real Slack workspace

### Phase 4: Reply Flow
- Extend `src/lib/gmail.ts` — `sendReply()` function
- Build `POST /api/reply` — send via Gmail API
- Build `GET /api/emails` — paginated, filtered email list
- Build `reply-editor`, `email-card`, `email-list` components
- Build `use-emails` hook
- Assemble email list + reply flow on `/dashboard` page

### Phase 5: Demo Mode Upgrade
- Create seed email data in `src/lib/seed-emails.ts`
- Upgrade `/demo` to run seed data through real AI pipeline
- Add simulated Slack digest step
- Add mock reply send
- Add `DEMO_SLACK_WEBHOOK_URL` env var support

### Phase 6: Polish + Deploy
- Update landing page with dashboard link
- Update `.env.example` with new variables
- Update README
- Test end-to-end locally
- Deploy to Vercel with new env vars
- Write `nextstepspart2.md`
