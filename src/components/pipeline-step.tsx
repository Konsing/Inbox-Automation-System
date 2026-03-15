"use client";

import { Check, X, Loader2 } from "lucide-react";
import type { PipelineStepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PipelineStepProps {
  label: string;
  status: PipelineStepStatus;
  isLast?: boolean;
}

const STATUS_STYLES: Record<PipelineStepStatus, string> = {
  waiting: "border-muted-foreground/30 bg-muted text-muted-foreground/50",
  active: "border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/25",
  complete: "border-green-500 bg-green-500 text-white",
  error: "border-red-500 bg-red-500 text-white",
};

const CONNECTOR_STYLES: Record<PipelineStepStatus, string> = {
  waiting: "bg-muted-foreground/20",
  active: "bg-blue-500/50",
  complete: "bg-green-500",
  error: "bg-red-500",
};

function StepIcon({ status }: { status: PipelineStepStatus }) {
  switch (status) {
    case "active":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "complete":
      return <Check className="h-4 w-4" />;
    case "error":
      return <X className="h-4 w-4" />;
    default:
      return <div className="h-2 w-2 rounded-full bg-current opacity-50" />;
  }
}

export function PipelineStepNode({ label, status, isLast }: PipelineStepProps) {
  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500",
            STATUS_STYLES[status],
            status === "active" && "animate-pulse"
          )}
        >
          <StepIcon status={status} />
        </div>
        <span
          className={cn(
            "text-xs font-medium transition-colors duration-300",
            status === "waiting" ? "text-muted-foreground/50" : "text-foreground"
          )}
        >
          {label}
        </span>
      </div>
      {!isLast && (
        <div
          className={cn(
            "mx-2 h-0.5 w-8 rounded-full transition-colors duration-500 sm:w-12",
            CONNECTOR_STYLES[status]
          )}
        />
      )}
    </div>
  );
}
