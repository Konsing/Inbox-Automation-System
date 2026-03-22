"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge, PriorityBadge, SentimentBadge } from "@/components/classification-badge";
import { ReplyEditor } from "@/components/reply-editor";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import type { Email } from "@/lib/types";

interface EmailCardProps {
  email: Email;
  demoMode?: boolean;
  onReplySent?: () => void;
}

export function EmailCard({ email, demoMode, onReplySent }: EmailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFullMessage, setShowFullMessage] = useState(false);

  // Roughly check if the message is long enough to need collapsing (~6 lines worth)
  const isLongMessage = (email.body_text?.length ?? 0) > 400;

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-2" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {email.from_name || email.from_address}
            </p>
            <p className="text-sm text-muted-foreground truncate">{email.subject}</p>
            {email.summary && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{email.summary}</p>
            )}
          </div>
          <button className="mt-0.5 shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {email.category && <CategoryBadge category={email.category} />}
          {email.priority && <PriorityBadge priority={email.priority} />}
          {email.sentiment && <SentimentBadge sentiment={email.sentiment} />}
          {email.reply_deadline && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {email.reply_deadline}
            </Badge>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="animate-in fade-in slide-in-from-top-1 space-y-3 pt-0 duration-200">
          {email.body_text && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3">
              <p className="mb-1 text-xs font-medium text-amber-400/80">Original Message</p>
              <div className="relative">
                <p className={`text-sm whitespace-pre-wrap break-words text-amber-100/70 ${isLongMessage && !showFullMessage ? "line-clamp-6" : ""}`}>
                  {email.body_text}
                </p>
                {isLongMessage && !showFullMessage && (
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-amber-950/80 to-transparent" />
                )}
              </div>
              {isLongMessage && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFullMessage(!showFullMessage); }}
                  className="mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {showFullMessage ? "Show less" : "Show full message"}
                </button>
              )}
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Draft Reply</p>
            <ReplyEditor
              emailId={email.id}
              draftReply={email.draft_reply}
              replySent={email.reply_sent}
              onSent={onReplySent ?? (() => {})}
              demoMode={demoMode}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
