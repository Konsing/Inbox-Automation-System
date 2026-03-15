"use client";

import { EmailCard } from "@/components/email-card";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Inbox } from "lucide-react";
import type { Email } from "@/lib/types";

interface EmailListProps {
  emails: Email[];
  isLoading: boolean;
  error: string | null;
  demoMode?: boolean;
  onReplySent?: () => void;
}

export function EmailList({ emails, isLoading, error, demoMode, onReplySent }: EmailListProps) {
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
          Failed to load emails: {error}
        </CardContent>
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No emails yet. Click &quot;Sync Now&quot; to fetch your inbox.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {emails.map((email) => (
        <EmailCard key={email.id} email={email} demoMode={demoMode} onReplySent={onReplySent} />
      ))}
    </div>
  );
}
