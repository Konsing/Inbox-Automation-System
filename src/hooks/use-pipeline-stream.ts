"use client";

import { useState, useCallback, useRef } from "react";
import type { Ticket, PipelineStep, PipelineStepStatus, PipelineEvent } from "@/lib/types";
import { getStoredPassword } from "@/components/password-gate";

const INITIAL_STEPS: PipelineStep[] = [
  { id: "received", label: "Received", description: "Message received", status: "waiting" },
  { id: "classifying", label: "Classifying", description: "AI analyzing message", status: "waiting" },
  { id: "classified", label: "Classified", description: "Classification complete", status: "waiting" },
  { id: "generating", label: "Generating", description: "AI writing response", status: "waiting" },
  { id: "done", label: "Complete", description: "Pipeline finished", status: "waiting" },
];

const STEP_ORDER = ["received", "classifying", "classified", "generating", "done"];

function updateStepStatuses(currentStepId: string): PipelineStep[] {
  const currentIndex = STEP_ORDER.indexOf(currentStepId);
  return INITIAL_STEPS.map((step, i) => {
    let status: PipelineStepStatus;
    if (i < currentIndex) status = "complete";
    else if (i === currentIndex) status = "active";
    else status = "waiting";
    return { ...step, status };
  });
}

function parseSSEEvents(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const lines = text.split("\n");
  let currentEvent = "";
  let currentData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7);
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6);
    } else if (line === "" && currentEvent) {
      events.push({ event: currentEvent, data: currentData });
      currentEvent = "";
      currentData = "";
    }
  }

  return events;
}

export function usePipelineStream() {
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startPipeline = useCallback(async (message: string) => {
    setIsRunning(true);
    setError(null);
    setCurrentTicket(null);
    setSteps(INITIAL_STEPS);

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, password: getStoredPassword() }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Pipeline request failed");
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
            const data: PipelineEvent = JSON.parse(evt.data);
            setCurrentTicket(data.ticket);
            setSteps(updateStepStatuses(data.step));
          } else if (evt.event === "error") {
            const data = JSON.parse(evt.data);
            setError(data.error || "Pipeline error");
            setSteps((prev) =>
              prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
            );
          }
        }

        // Keep only unprocessed data in buffer
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
    setCurrentTicket(null);
    setIsRunning(false);
    setError(null);
  }, []);

  return { steps, currentTicket, isRunning, error, startPipeline, reset };
}
