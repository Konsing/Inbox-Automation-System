"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PasswordGate } from "@/components/password-gate";
import { Header } from "@/components/header";
import { PipelineStepNode } from "@/components/pipeline-step";
import { CategoryBadge, PriorityBadge, SentimentBadge } from "@/components/classification-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Loader2, Info, Mail, ArrowRight, Check, AlertCircle, Bot, MessageSquare } from "lucide-react";
import { SEED_EMAILS } from "@/lib/seed-emails";
import { getStoredPassword } from "@/components/password-gate";
import type { PipelineStepStatus, Category, Priority, Sentiment } from "@/lib/types";

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

// --- Main Demo Component ---

function DemoContent() {
  const [steps, setSteps] = useState<DemoStep[]>(INITIAL_STEPS);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addActivity = useCallback((entry: Omit<ActivityEntry, "id" | "timestamp">) => {
    setActivity((prev) => [...prev, { ...entry, id: crypto.randomUUID(), timestamp: new Date() }]);
  }, []);

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
        addActivity({
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

          // Parse the last ticket state
          const dataMatches = [...result.matchAll(/data: ({.*})/g)];
          const lastData = dataMatches[dataMatches.length - 1];
          if (lastData) {
            const parsed = JSON.parse(lastData[1]);
            if (parsed.ticket && parsed.ticket.category) {
              addActivity({
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
          addActivity({
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
    }
  }, [addActivity]);

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
