"use client";

import { useState, useCallback } from "react";
import { PasswordGate } from "@/components/password-gate";
import { Header } from "@/components/header";
import { EmailList } from "@/components/email-list";
import { PipelineStepNode } from "@/components/pipeline-step";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Loader2, Info } from "lucide-react";
import { SEED_EMAILS } from "@/lib/seed-emails";
import { getStoredPassword } from "@/components/password-gate";
import type { Email, PipelineStepStatus } from "@/lib/types";

type DemoStepId = "authenticating" | "fetching" | "classifying" | "drafting" | "storing" | "notifying" | "done";

interface DemoStep {
  id: DemoStepId;
  label: string;
  status: PipelineStepStatus;
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

function buildSteps(activeId: DemoStepId): DemoStep[] {
  const activeIdx = STEP_ORDER.indexOf(activeId);
  return INITIAL_STEPS.map((s, i) => ({
    ...s,
    status: i < activeIdx ? "complete" : i === activeIdx ? (activeId === "done" ? "complete" : "active") : "waiting",
  }));
}

function DemoContent() {
  const [steps, setSteps] = useState<DemoStep[]>(INITIAL_STEPS);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDemoSync = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setEmails([]);
    setSteps(INITIAL_STEPS);

    try {
      // Simulate authenticating
      setSteps(buildSteps("authenticating"));
      await new Promise((r) => setTimeout(r, 500));

      // Simulate fetching
      setSteps(buildSteps("fetching"));
      await new Promise((r) => setTimeout(r, 800));

      // Classify seed emails via real AI pipeline
      setSteps(buildSteps("classifying"));

      const classifiedEmails: Email[] = [];
      for (const seed of SEED_EMAILS) {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `From: ${seed.from_name} <${seed.from_address}>\nSubject: ${seed.subject}\n\n${seed.body_text}`,
            password: getStoredPassword(),
          }),
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

      // Drafting (already done via pipeline)
      setSteps(buildSteps("drafting"));
      await new Promise((r) => setTimeout(r, 300));

      // Storing (simulated)
      setSteps(buildSteps("storing"));
      await new Promise((r) => setTimeout(r, 400));

      // Notifying (simulated Slack)
      setSteps(buildSteps("notifying"));
      await new Promise((r) => setTimeout(r, 300));

      // Done
      setSteps(buildSteps("done"));
      setEmails(classifiedEmails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sync failed");
    } finally {
      setIsRunning(false);
    }
  }, []);

  const hasStarted = steps.some((s) => s.status !== "waiting");

  return (
    <div className="dark min-h-screen bg-background text-foreground">
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
