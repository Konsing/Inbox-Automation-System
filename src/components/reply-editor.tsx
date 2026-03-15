"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Check } from "lucide-react";

interface ReplyEditorProps {
  emailId: string;
  draftReply: string | null;
  replySent: boolean;
  onSent: () => void;
  demoMode?: boolean;
}

export function ReplyEditor({ emailId, draftReply, replySent, onSent, demoMode }: ReplyEditorProps) {
  const [body, setBody] = useState(draftReply ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(replySent);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);

    try {
      if (demoMode) {
        await new Promise((r) => setTimeout(r, 500));
      } else {
        const res = await fetch("/api/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailId, body: body.trim() }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to send");
        }
      }
      setSent(true);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <Check className="h-4 w-4" />
        Reply sent
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write your reply..."
        className="resize-none text-sm"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button size="sm" onClick={handleSend} disabled={!body.trim() || sending}>
        {sending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
        {sending ? "Sending..." : "Send Reply"}
      </Button>
    </div>
  );
}
