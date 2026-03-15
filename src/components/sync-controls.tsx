"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

interface SyncControlsProps {
  onSync: () => void;
  isRunning: boolean;
  connected: boolean;
}

export function SyncControls({ onSync, isRunning, connected }: SyncControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button onClick={onSync} disabled={isRunning || !connected}>
        {isRunning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        {isRunning ? "Syncing..." : "Sync Now"}
      </Button>
    </div>
  );
}
