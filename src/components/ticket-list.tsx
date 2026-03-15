"use client";

import { useTickets } from "@/hooks/use-tickets";
import { TicketCard } from "@/components/ticket-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Inbox } from "lucide-react";

export function TicketList() {
  const { tickets, isLoading, error } = useTickets(1, 20);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-red-500">
          Failed to load tickets: {error}
        </CardContent>
      </Card>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No tickets yet. Send a message to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <CardHeader className="px-0 pb-2">
        <CardTitle className="text-base">
          Recent Tickets ({tickets.length})
        </CardTitle>
      </CardHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  );
}
