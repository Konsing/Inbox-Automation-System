"use client";

import { useState, useEffect, useCallback } from "react";

interface SessionState {
  email: string | null;
  connected: boolean;
  isLoading: boolean;
  disconnect: () => Promise<void>;
  refetch: () => void;
}

export function useSession(): SessionState {
  const [email, setEmail] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!cancelled) {
          setConnected(data.connected);
          setEmail(data.email ?? null);
        }
      } catch {
        if (!cancelled) {
          setConnected(false);
          setEmail(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const disconnect = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setConnected(false);
    setEmail(null);
  }, []);

  return { email, connected, isLoading, disconnect, refetch };
}
