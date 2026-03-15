"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CategoryBadge, PriorityBadge, SentimentBadge } from "@/components/classification-badge";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import type { Ticket } from "@/lib/types";

interface TicketCardProps {
  ticket: Ticket;
}

export function TicketCard({ ticket }: TicketCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isError = ticket.status === "error";

  return (
    <Card className={isError ? "border-red-200 dark:border-red-900" : ""}>
      <CardHeader className="cursor-pointer pb-2" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-relaxed line-clamp-2">
            {ticket.message}
          </p>
          <button className="mt-0.5 shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {ticket.category && <CategoryBadge category={ticket.category} />}
          {ticket.priority && <PriorityBadge priority={ticket.priority} />}
          {ticket.sentiment && <SentimentBadge sentiment={ticket.sentiment} />}
          {isError && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> Error
            </span>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="animate-in fade-in slide-in-from-top-1 pt-0 duration-200">
          {ticket.ai_response && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                AI Response
              </p>
              <p className="text-sm whitespace-pre-wrap">{ticket.ai_response}</p>
            </div>
          )}
          {ticket.error_message && (
            <p className="text-sm text-red-500">{ticket.error_message}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(ticket.created_at).toLocaleString()}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
