"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PasswordGate } from "@/components/password-gate";
import { Header } from "@/components/header";
import { PipelineStepNode } from "@/components/pipeline-step";
import { CategoryBadge, PriorityBadge, SentimentBadge } from "@/components/classification-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Loader2, Info, Mail, ArrowRight, Check, AlertCircle, Bot, MessageSquare, History, BarChart3, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { SEED_EMAILS } from "@/lib/seed-emails";
import { getStoredPassword } from "@/components/password-gate";
import type { PipelineStepStatus, Category, Priority, Sentiment, Ticket } from "@/lib/types";

type DemoStepId = "authenticating" | "fetching" | "classifying" | "drafting" | "storing" | "notifying" | "done";

interface DemoStep {
  id: DemoStepId;
  label: string;
  status: PipelineStepStatus;
}

// A single entry in the live activity feed
interface ActivityEntry {
  id: string;
  type: "info" | "email-received" | "classifying" | "classified" | "error";
  message: string;
  email?: {
    from: string;
    subject: string;
    body: string;
    category?: Category;
    priority?: Priority;
    sentiment?: Sentiment;
    aiResponse?: string;
  };
  timestamp: Date;
}

const STEP_ORDER: DemoStepId[] = ["authenticating", "fetching", "classifying", "drafting", "storing", "notifying", "done"];

const INITIAL_STEPS: DemoStep[] = [
  { id: "authenticating", label: "Authenticating", status: "waiting" },
  { id: "fetching", label: "Fetching", status: "waiting" },
  { id: "classifying", label: "Classifying", status: "waiting" },
  { id: "drafting", label: "Drafting", status: "waiting" },
  { id: "storing", label: "Storing", status: "waiting" },
  { id: "notifying", label: "Notifying", status: "waiting" },
  { id: "done", label: "Complete", status: "waiting" },
];

// Only use 3 seed emails to stay within Gemini free tier rate limits (5 RPM)
const DEMO_EMAILS = SEED_EMAILS.slice(0, 3);

function buildSteps(activeId: DemoStepId): DemoStep[] {
  const activeIdx = STEP_ORDER.indexOf(activeId);
  return INITIAL_STEPS.map((s, i) => ({
    ...s,
    status: i < activeIdx ? "complete" : i === activeIdx ? (activeId === "done" ? "complete" : "active") : "waiting",
  }));
}

// --- Activity Feed Components ---

function ActivityIcon({ type }: { type: ActivityEntry["type"] }) {
  switch (type) {
    case "info":
      return <Info className="h-4 w-4 text-blue-400" />;
    case "email-received":
      return <Mail className="h-4 w-4 text-yellow-400" />;
    case "classifying":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case "classified":
      return <Check className="h-4 w-4 text-green-400" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
  }
}

function ActivityItem({ entry, isLatest }: { entry: ActivityEntry; isLatest: boolean }) {
  return (
    <div className={`relative flex gap-3 pb-4 ${isLatest ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""}`}>
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
          <ActivityIcon type={entry.type} />
        </div>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-1 pt-0.5">
        <p className="text-sm text-foreground">{entry.message}</p>

        {/* Email details when classified */}
        {entry.type === "classified" && entry.email && (
          <div className="mt-2 space-y-2">
            {/* Classification badges */}
            <div className="flex flex-wrap gap-1.5">
              {entry.email.category && <CategoryBadge category={entry.email.category} />}
              {entry.email.priority && <PriorityBadge priority={entry.email.priority} />}
              {entry.email.sentiment && <SentimentBadge sentiment={entry.email.sentiment} />}
            </div>

            {/* Original message preview */}
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Original Message</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{entry.email.body}</p>
            </div>

            {/* AI Response */}
            {entry.email.aiResponse && (
              <div className="rounded-md border border-blue-900/50 bg-blue-950/30 p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">AI Response</span>
                </div>
                <p className="text-sm text-blue-200/80 line-clamp-4">{entry.email.aiResponse}</p>
              </div>
            )}
          </div>
        )}

        {/* Incoming email preview */}
        {entry.type === "email-received" && entry.email && (
          <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{entry.email.from}</span>
              {" — "}{entry.email.subject}
            </p>
          </div>
        )}

        {/* Error details */}
        {entry.type === "error" && (
          <div className="mt-1.5 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2">
            <p className="text-xs text-red-300">{entry.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div ref={feedRef} className="max-h-[600px] overflow-y-auto pr-1">
      {entries.map((entry, i) => (
        <ActivityItem key={entry.id} entry={entry} isLatest={i === entries.length - 1} />
      ))}
    </div>
  );
}

// --- Run Summary ---

const PRIORITY_RESPONSE_TIME: Record<Priority, string> = {
  urgent: "Within 1 hour",
  high: "Within 4 hours",
  medium: "Within 24 hours",
  low: "Within 48 hours",
};

const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  negative: "bg-red-500",
  neutral: "bg-gray-500",
  positive: "bg-green-500",
};

interface ClassifiedEmail {
  from: string;
  subject: string;
  body: string;
  category: Category;
  priority: Priority;
  sentiment: Sentiment;
  aiResponse?: string;
}

function parseTicketMessage(message: string): { from: string; subject: string; body: string } {
  const fromMatch = message.match(/^From: (.+?)$/m);
  const subjectMatch = message.match(/^Subject: (.+?)$/m);
  const bodyStart = message.indexOf("\n\n");
  return {
    from: fromMatch?.[1] ?? "Unknown",
    subject: subjectMatch?.[1] ?? "No subject",
    body: bodyStart >= 0 ? message.slice(bodyStart + 2) : message,
  };
}

function getClassifiedFromActivity(entries: ActivityEntry[]): ClassifiedEmail[] {
  return entries
    .filter((e) => e.type === "classified" && e.email?.category)
    .map((e) => ({
      from: e.email!.from,
      subject: e.email!.subject,
      body: e.email!.body,
      category: e.email!.category!,
      priority: e.email!.priority!,
      sentiment: e.email!.sentiment!,
      aiResponse: e.email!.aiResponse,
    }));
}

function getClassifiedFromTickets(tickets: Ticket[]): ClassifiedEmail[] {
  return tickets
    .filter((t) => t.status === "done" && t.category)
    .map((t) => {
      const { from, subject, body } = parseTicketMessage(t.message);
      return {
        from,
        subject,
        body,
        category: t.category!,
        priority: t.priority!,
        sentiment: t.sentiment!,
        aiResponse: t.ai_response ?? undefined,
      };
    });
}

function StatBar({ label, segments }: { label: string; segments: { color: string; count: number; label: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {segments.filter((s) => s.count > 0).map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all duration-500`}
            style={{ width: `${(seg.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.filter((s) => s.count > 0).map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${seg.color}`} />
            <span className="text-xs text-muted-foreground">{seg.count} {seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionItem({ email, index }: { email: ClassifiedEmail; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border">
      <div
        className="flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{email.subject}</p>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">From {email.from}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={email.priority} />
            <CategoryBadge category={email.category} />
            <SentimentBadge sentiment={email.sentiment} />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {PRIORITY_RESPONSE_TIME[email.priority]}
            </span>
          </div>
        </div>
      </div>
      {expanded && email.aiResponse && (
        <div className="border-t border-border px-3 pb-3 pt-2 animate-in fade-in duration-200">
          <div className="rounded-md border border-blue-900/50 bg-blue-950/30 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-medium text-blue-400">Suggested Reply</span>
            </div>
            <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{email.aiResponse}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function RunSummary({ emails }: { emails: ClassifiedEmail[] }) {
  if (emails.length === 0) return null;

  // Sort by priority (urgent first)
  const sorted = [...emails].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));

  const priorityCounts = PRIORITY_ORDER.map((p) => ({
    color: PRIORITY_COLORS[p],
    count: emails.filter((e) => e.priority === p).length,
    label: p,
  }));

  const sentimentCounts: Sentiment[] = ["negative", "neutral", "positive"];
  const sentimentSegments = sentimentCounts.map((s) => ({
    color: SENTIMENT_COLORS[s],
    count: emails.filter((e) => e.sentiment === s).length,
    label: s,
  }));

  const categoryCounts = (["refund", "billing", "technical", "general"] as Category[]).map((c) => ({
    color: c === "refund" ? "bg-blue-500" : c === "billing" ? "bg-purple-500" : c === "technical" ? "bg-orange-500" : "bg-gray-500",
    count: emails.filter((e) => e.category === c).length,
    label: c,
  }));

  const urgentHighCount = emails.filter((e) => e.priority === "urgent" || e.priority === "high").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Run Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stats overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-2xl font-bold">{emails.length}</p>
            <p className="text-xs text-muted-foreground">Classified</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{urgentHighCount}</p>
            <p className="text-xs text-muted-foreground">Need Attention</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{emails.filter((e) => e.aiResponse).length}</p>
            <p className="text-xs text-muted-foreground">Drafts Ready</p>
          </div>
        </div>

        {/* Distribution bars */}
        <div className="space-y-3">
          <StatBar label="Priority Distribution" segments={priorityCounts} />
          <StatBar label="Sentiment Analysis" segments={sentimentSegments} />
          <StatBar label="Categories" segments={categoryCounts} />
        </div>

        {/* Action items sorted by priority */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Action Items — Reply Timeline</p>
          {sorted.map((email, i) => (
            <ActionItem key={`${email.subject}-${i}`} email={email} index={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Previous Runs ---

function groupTicketsByRun(tickets: Ticket[]): Ticket[][] {
  if (tickets.length === 0) return [];
  const groups: Ticket[][] = [];
  let current: Ticket[] = [tickets[0]];

  for (let i = 1; i < tickets.length; i++) {
    const prev = new Date(tickets[i - 1].created_at).getTime();
    const curr = new Date(tickets[i].created_at).getTime();
    // Tickets within 5 minutes of each other = same run
    if (Math.abs(prev - curr) < 5 * 60 * 1000) {
      current.push(tickets[i]);
    } else {
      groups.push(current);
      current = [tickets[i]];
    }
  }
  groups.push(current);
  return groups;
}

function TicketResult({ ticket }: { ticket: Ticket }) {
  const { from, subject, body } = parseTicketMessage(ticket.message);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="cursor-pointer rounded-md border border-border p-3 transition-colors hover:bg-muted/30"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{from}</p>
          <p className="text-sm text-muted-foreground truncate">{subject}</p>
        </div>
        {ticket.status === "error" && (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
        )}
      </div>
      {ticket.category && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <CategoryBadge category={ticket.category} />
          {ticket.priority && <PriorityBadge priority={ticket.priority} />}
          {ticket.sentiment && <SentimentBadge sentiment={ticket.sentiment} />}
        </div>
      )}
      {expanded && (
        <div className="mt-2 space-y-2 animate-in fade-in duration-200">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Original Message</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-4">{body}</p>
          </div>
          {ticket.ai_response && (
            <div className="rounded-md border border-blue-900/50 bg-blue-950/30 p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-medium text-blue-400">AI Response</span>
              </div>
              <p className="text-sm text-blue-200/80 line-clamp-6">{ticket.ai_response}</p>
            </div>
          )}
          {ticket.error_message && (
            <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2">
              <p className="text-xs text-red-300">{ticket.error_message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DayGroup {
  dateLabel: string;
  runs: { time: Date; tickets: Ticket[] }[];
}

function groupRunsByDay(runs: Ticket[][]): DayGroup[] {
  const dayMap = new Map<string, { time: Date; tickets: Ticket[] }[]>();

  for (const run of runs) {
    const runTime = new Date(run[0].created_at);
    const dateKey = runTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
    dayMap.get(dateKey)!.push({ time: runTime, tickets: run });
  }

  return Array.from(dayMap.entries()).map(([dateLabel, runs]) => ({ dateLabel, runs }));
}

function PreviousRuns({ runs }: { runs: Ticket[][] }) {
  if (runs.length === 0) return null;

  const days = groupRunsByDay(runs);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Previous Runs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {days.map((day, dayIdx) => (
          <div key={day.dateLabel}>
            {/* Day separator */}
            {dayIdx > 0 && <div className="my-5 border-t-2 border-border" />}

            {/* Day header */}
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <p className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {day.dateLabel}
              </p>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Runs within this day */}
            <div className="space-y-4">
              {day.runs.map((run, runIdx) => {
                const successCount = run.tickets.filter((t) => t.status === "done").length;
                const errorCount = run.tickets.filter((t) => t.status === "error").length;

                return (
                  <div key={runIdx} className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground">
                        {run.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {successCount} classified{errorCount > 0 ? `, ${errorCount} failed` : ""}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {run.tickets.map((ticket) => (
                        <TicketResult key={ticket.id} ticket={ticket} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Main Demo Component ---

function DemoContent() {
  const [steps, setSteps] = useState<DemoStep[]>(INITIAL_STEPS);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [previousRuns, setPreviousRuns] = useState<Ticket[][]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addActivity = useCallback((entry: Omit<ActivityEntry, "id" | "timestamp"> & { id?: string }) => {
    const full = { ...entry, id: entry.id ?? crypto.randomUUID(), timestamp: new Date() };
    setActivity((prev) => [...prev, full]);
  }, []);

  const updateActivity = useCallback((id: string, updates: Partial<Omit<ActivityEntry, "id">>) => {
    setActivity((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates, timestamp: new Date() } : e)));
  }, []);

  const fetchPreviousRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets?limit=50");
      if (res.ok) {
        const data = await res.json();
        const tickets: Ticket[] = data.tickets ?? [];
        setPreviousRuns(groupTicketsByRun(tickets));
      }
    } catch {
      // Non-critical, silently fail
    }
  }, []);

  useEffect(() => {
    fetchPreviousRuns();
  }, [fetchPreviousRuns]);

  const runDemoSync = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setActivity([]);
    setSteps(INITIAL_STEPS);

    try {
      // Authenticate
      setSteps(buildSteps("authenticating"));
      addActivity({ type: "info", message: "Authenticating with email server..." });
      await new Promise((r) => setTimeout(r, 500));

      // Fetch
      setSteps(buildSteps("fetching"));
      addActivity({ type: "info", message: `Found ${DEMO_EMAILS.length} unread emails in inbox` });
      await new Promise((r) => setTimeout(r, 600));

      // Show all incoming emails
      for (const seed of DEMO_EMAILS) {
        addActivity({
          type: "email-received",
          message: `Email received from ${seed.from_name}`,
          email: { from: seed.from_name, subject: seed.subject, body: seed.body_text },
        });
        await new Promise((r) => setTimeout(r, 300));
      }

      await new Promise((r) => setTimeout(r, 400));

      // Classify each email through the real AI pipeline
      setSteps(buildSteps("classifying"));

      for (let idx = 0; idx < DEMO_EMAILS.length; idx++) {
        const seed = DEMO_EMAILS[idx];
        const entryId = `classify-${idx}`;
        addActivity({
          id: entryId,
          type: "classifying",
          message: `Classifying email ${idx + 1} of ${DEMO_EMAILS.length}: "${seed.subject}"`,
        });

        try {
          const res = await fetch("/api/pipeline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `From: ${seed.from_name} <${seed.from_address}>\nSubject: ${seed.subject}\n\n${seed.body_text}`,
              password: getStoredPassword(),
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
          }

          // Read SSE stream
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let result = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });
          }

          // Check for SSE error events
          if (result.includes("event: error")) {
            const errorMatch = result.match(/event: error\ndata: ({.*})/);
            if (errorMatch) {
              const errData = JSON.parse(errorMatch[1]);
              throw new Error(errData.error || "Classification failed");
            }
          }

          // Parse the last ticket state (match only "event: step" lines, skip "event: complete")
          const dataMatches = [...result.matchAll(/event: step\ndata: ({.*})/g)];
          const lastData = dataMatches[dataMatches.length - 1];
          if (lastData) {
            const parsed = JSON.parse(lastData[1]);
            if (parsed.ticket && parsed.ticket.category) {
              // Replace the "classifying" spinner with the classified result
              updateActivity(entryId, {
                type: "classified",
                message: `Classified: "${seed.subject}"`,
                email: {
                  from: seed.from_name,
                  subject: seed.subject,
                  body: seed.body_text,
                  category: parsed.ticket.category,
                  priority: parsed.ticket.priority,
                  sentiment: parsed.ticket.sentiment,
                  aiResponse: parsed.ticket.ai_response,
                },
              });
            }
          }
        } catch (emailErr) {
          const msg = emailErr instanceof Error ? emailErr.message : "Unknown error";
          // Replace the "classifying" spinner with an error
          updateActivity(entryId, {
            type: "error",
            message: `Failed to classify email ${idx + 1}: ${msg}`,
          });
          setError(`Email ${idx + 1} failed: ${msg}. ${idx + 1 < DEMO_EMAILS.length ? "Continuing..." : ""}`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // Remaining simulated steps
      setSteps(buildSteps("drafting"));
      addActivity({ type: "info", message: "Draft replies generated for all emails" });
      await new Promise((r) => setTimeout(r, 400));

      setSteps(buildSteps("storing"));
      addActivity({ type: "info", message: "All tickets saved to database" });
      await new Promise((r) => setTimeout(r, 400));

      setSteps(buildSteps("notifying"));
      addActivity({ type: "info", message: "Slack digest posted with summary" });
      await new Promise((r) => setTimeout(r, 400));

      // Done
      setSteps(buildSteps("done"));
      addActivity({ type: "info", message: `Pipeline complete — ${DEMO_EMAILS.length} emails processed` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sync failed");
    } finally {
      setIsRunning(false);
      fetchPreviousRuns();
    }
  }, [addActivity, updateActivity, fetchPreviousRuns]);

  const hasStarted = steps.some((s) => s.status !== "waiting");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto space-y-6 px-4 py-6">
        <div className="rounded-lg border border-blue-900 bg-blue-950 px-4 py-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-400" />
            <p className="text-sm text-blue-200">
              Demo mode — uses sample emails to demonstrate the AI classification and reply pipeline. Click &quot;Run Demo Sync&quot; to start.
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
              <CardTitle className="text-base">Pipeline Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step visualization */}
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
                <div className="rounded-lg border border-red-900 bg-red-950 p-3">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Live Activity Feed */}
        {activity.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRight className="h-4 w-4" />
                Live Activity
                {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed entries={activity} />
            </CardContent>
          </Card>
        )}

        {/* Run Summary — accumulates all classified tickets from Supabase */}
        {!isRunning && (
          <RunSummary emails={getClassifiedFromTickets(previousRuns.flat())} />
        )}

        {/* Previous Runs */}
        <PreviousRuns runs={previousRuns} />
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
