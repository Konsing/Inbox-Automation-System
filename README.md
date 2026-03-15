# AI Inbox Automation System

An AI-powered message classification and response pipeline that demonstrates real-time automation engineering. Submit a customer message and watch the AI pipeline classify it, generate a professional response, and store the ticket — all with a live animated visualization.

## What It Does

```
User submits message
        |
        v
  API receives it
        |
        v
  AI classifies message
  (category, priority, sentiment)
        |
        v
  AI generates response
        |
        v
  Ticket stored in database
        |
        v
  Dashboard updates in real-time
```

The pipeline streams progress to the browser via Server-Sent Events (SSE), so you can watch each step happen live.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js (App Router) + Tailwind + shadcn/ui | Dashboard and pipeline visualizer |
| Backend | Next.js API Routes | Pipeline orchestration and SSE streaming |
| AI | Google Gemini Flash | Message classification and response generation |
| Database | Supabase (PostgreSQL) | Ticket storage and retrieval |
| Hosting | Vercel | Free deployment |

## How It Works

### The Pipeline (Async Generator Pattern)

The core of the system is an async generator function that runs the AI pipeline step by step:

1. **Receive** — Creates a ticket in Supabase
2. **Classify** — Sends the message to Gemini AI with JSON mode to extract category (refund/billing/technical/general), priority (low/medium/high/urgent), and sentiment (positive/neutral/negative)
3. **Generate** — Sends the message + classification context to Gemini AI to produce a professional response
4. **Complete** — Updates the ticket with the AI response and marks it done

Each step `yield`s an event that gets encoded as SSE and streamed to the browser in real-time.

### Real-Time Visualization

The frontend uses a custom `usePipelineStream` hook that:
- Opens a `fetch()` POST request to the pipeline endpoint
- Reads the response body as a stream via `ReadableStream`
- Parses SSE events and updates the UI state
- Drives the animated pipeline visualizer component

### Classification

Gemini AI classifies each message into:
- **Category**: refund, billing, technical, or general
- **Priority**: low, medium, high, or urgent
- **Sentiment**: positive, neutral, or negative

Uses Gemini's JSON mode (`responseMimeType: "application/json"`) with a schema constraint to ensure structured output.

## Architecture

```
Browser (Vercel)
    |
    |-- POST /api/pipeline --> Gemini AI (classify + respond) --> Supabase (store)
    |       |
    |       +-- SSE stream back to browser (real-time step updates)
    |
    +-- GET /api/tickets --> Supabase (query)
```

Everything runs as a single Next.js application — no separate backend, no message queues, no workflow engine.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (free)

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/Konsing/Inbox-Automation-System.git
   cd Inbox-Automation-System
   npm install
   ```

2. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run the migration in `supabase/migrations/001_create_tickets.sql`
   - Copy your project URL, anon key, and service role key from Project Settings > API

3. **Get a Gemini API key**
   - Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Create an API key

4. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your keys in `.env.local`

5. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   └── api/
│       ├── pipeline/route.ts       # POST — SSE streaming pipeline
│       └── tickets/route.ts        # GET — ticket history
├── components/
│   ├── pipeline-visualizer.tsx     # Animated pipeline display
│   ├── pipeline-step.tsx           # Individual step node
│   ├── message-input.tsx           # Message form with examples
│   ├── ticket-card.tsx             # Expandable ticket display
│   ├── ticket-list.tsx             # Ticket history grid
│   ├── classification-badge.tsx    # Color-coded badges
│   └── header.tsx                  # App header
├── hooks/
│   ├── use-pipeline-stream.ts      # SSE consumer hook
│   └── use-tickets.ts              # Ticket fetch hook
└── lib/
    ├── pipeline.ts                 # Async generator orchestration
    ├── gemini.ts                   # AI classification + response
    ├── supabase.ts                 # Database client
    └── types.ts                    # Shared TypeScript types
```

## Deployment

Deploy to Vercel for free:

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add environment variables in the Vercel dashboard
4. Deploy

## Free Tier Limits

| Service | Limit | Impact |
|---------|-------|--------|
| Vercel | 25s function timeout | Pipeline runs in ~3-8s |
| Gemini Flash | 15 requests/min, 1M tokens/day | ~7 pipeline runs/min |
| Supabase | 500MB database, 50K rows | Thousands of tickets |
