"use client";

import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export function GoogleSignIn() {
  const { email, connected, isLoading, disconnect } = useSession();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking connection...
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm">
          Connected as <span className="font-medium">{email}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <a href="/api/auth/google">
      <Button>
        <LogIn className="mr-2 h-4 w-4" />
        Sign in with Google
      </Button>
    </a>
  );
}
