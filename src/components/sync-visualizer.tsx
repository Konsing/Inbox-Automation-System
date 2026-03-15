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
