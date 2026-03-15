"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface MessageInputProps {
  onSubmit: (message: string) => void;
  isRunning: boolean;
}

const EXAMPLE_MESSAGES = [
  "Customer is angry about a refund that hasn't been processed after 2 weeks.",
  "I can't log into my account. Password reset isn't working.",
  "Thanks for the quick shipping! Everything arrived in perfect condition.",
  "I was charged twice for my subscription this month.",
];

export function MessageInput({ onSubmit, isRunning }: MessageInputProps) {
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isRunning) return;
    onSubmit(trimmed);
    setMessage("");
  }

  function handleExample(example: string) {
    setMessage(example);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="Type a customer message to process..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isRunning}
        rows={3}
        className="resize-none"
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_MESSAGES.map((example, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleExample(example)}
              disabled={isRunning}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              Example {i + 1}
            </button>
          ))}
        </div>
        <Button type="submit" disabled={!message.trim() || isRunning}>
          {isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {isRunning ? "Processing..." : "Send"}
        </Button>
      </div>
    </form>
  );
}
