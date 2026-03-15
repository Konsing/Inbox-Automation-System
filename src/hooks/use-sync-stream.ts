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
    else if (i === currentIndex) status = currentStepId === "done" ? "complete" : "active";
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
