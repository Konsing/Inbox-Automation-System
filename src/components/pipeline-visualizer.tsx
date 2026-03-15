"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineStepNode } from "@/components/pipeline-step";
import { CategoryBadge, PriorityBadge, SentimentBadge } from "@/components/classification-badge";
import type { PipelineStep, Ticket } from "@/lib/types";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineVisualizerProps {
  steps: PipelineStep[];
  ticket: Ticket | null;
  isRunning: boolean;
  error: string | null;
}

export function PipelineVisualizer({
  steps,
  ticket,
  isRunning,
  error,
}: PipelineVisualizerProps) {
  const hasStarted = steps.some((s) => s.status !== "waiting");
  const isClassified = ticket?.category && ticket?.priority && ticket?.sentiment;
  const isDone = ticket?.status === "done";

  if (!hasStarted) return null;

  return (
    <Card
      className={cn(
        "transition-all duration-500",
        isRunning && "ring-2 ring-blue-500/20"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Pipeline Status
          {isRunning && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Processing...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step indicators */}
        <div className="flex items-start justify-center py-2">
          {steps.map((step, i) => (
            <PipelineStepNode
              key={step.id}
              label={step.label}
              status={step.status}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>

        {/* Classification results */}
        {isClassified && (
          <div className="animate-in fade-in slide-in-from-top-2 rounded-lg border bg-muted/50 p-4 duration-500">
            <p className="mb-2 text-sm font-medium">Classification</p>
            <div className="flex flex-wrap gap-2">
              <CategoryBadge category={ticket.category!} />
              <PriorityBadge priority={ticket.priority!} />
              <SentimentBadge sentiment={ticket.sentiment!} />
            </div>
          </div>
        )}

        {/* AI Response */}
        {isDone && ticket.ai_response && (
          <div className="animate-in fade-in slide-in-from-top-2 rounded-lg border bg-muted/50 p-4 duration-500">
            <p className="mb-2 text-sm font-medium">AI Response</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {ticket.ai_response}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
