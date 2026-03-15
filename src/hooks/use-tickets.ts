"use client";

import { useState, useEffect, useCallback } from "react";
import type { Ticket } from "@/lib/types";

interface UseTicketsResult {
  tickets: Ticket[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTickets(page = 1, limit = 20): UseTicketsResult {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchTickets() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/tickets?page=${page}&limit=${limit}`);
        if (!res.ok) throw new Error("Failed to fetch tickets");

        const data = await res.json();
        if (!cancelled) {
          setTickets(data.tickets);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchTickets();
    return () => { cancelled = true; };
  }, [page, limit, refreshKey]);

  return { tickets, total, isLoading, error, refetch };
}
