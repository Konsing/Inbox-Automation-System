"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { GoogleSignIn } from "@/components/google-sign-in";
import { SyncControls } from "@/components/sync-controls";
import { SyncVisualizer } from "@/components/sync-visualizer";
import { EmailList } from "@/components/email-list";
import { useSession } from "@/hooks/use-session";
import { useSyncStream } from "@/hooks/use-sync-stream";
import { useEmails } from "@/hooks/use-emails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail } from "lucide-react";

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const { connected, isLoading: sessionLoading } = useSession();
  const { steps, isRunning, error: syncError, startSync } = useSyncStream();
  const { emails, isLoading: emailsLoading, error: emailsError, refetch } = useEmails();

  const handleSync = useCallback(async () => {
    await startSync();
    refetch();
  }, [startSync, refetch]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto space-y-6 px-4 py-6">
        {/* Auth Error Banner */}
        {authError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {authError === "csrf_failed"
              ? "Authentication failed (CSRF mismatch). Please try again."
              : "Authentication failed. Please try again."}
          </div>
        )}

        {/* Connection + Sync Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Gmail Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <GoogleSignIn />
            {connected && <SyncControls onSync={handleSync} isRunning={isRunning} connected={connected} />}
          </CardContent>
        </Card>

        {/* Sync Visualizer */}
        <SyncVisualizer steps={steps} isRunning={isRunning} error={syncError} />

        <Separator />

        {/* Email List */}
        {connected && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Inbox</h2>
            <EmailList
              emails={emails}
              isLoading={emailsLoading}
              error={emailsError}
              onReplySent={refetch}
            />
          </div>
        )}

        {!connected && !sessionLoading && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Mail className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Sign in with Google to connect your inbox.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
