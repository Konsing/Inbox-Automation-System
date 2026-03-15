"use client";

import { useCallback, useState } from "react";
import { Header } from "@/components/header";
import { MessageInput } from "@/components/message-input";
import { PipelineVisualizer } from "@/components/pipeline-visualizer";
import { TicketList } from "@/components/ticket-list";
import { PasswordGate } from "@/components/password-gate";
import { usePipelineStream } from "@/hooks/use-pipeline-stream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MessageSquare } from "lucide-react";

export default function DemoPage() {
  const { steps, currentTicket, isRunning, error, startPipeline } =
    usePipelineStream();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = useCallback(
    async (message: string) => {
      await startPipeline(message);
      setRefreshKey((k) => k + 1);
    },
    [startPipeline]
  );

  return (
    <PasswordGate>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto space-y-6 px-4 py-6">
          {/* Demo Banner */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            This is an interactive demo. Type a customer message (or use an example) and watch the AI pipeline process it in real-time.
          </div>

          {/* Message Input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                New Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MessageInput onSubmit={handleSubmit} isRunning={isRunning} />
            </CardContent>
          </Card>

          {/* Pipeline Visualization */}
          <PipelineVisualizer
            steps={steps}
            ticket={currentTicket}
            isRunning={isRunning}
            error={error}
          />

          <Separator />

          {/* Ticket History */}
          <TicketList key={refreshKey} />
        </main>
      </div>
    </PasswordGate>
  );
}
