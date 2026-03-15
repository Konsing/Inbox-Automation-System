"use client";

import { useState, useEffect, useCallback } from "react";
import type { Email } from "@/lib/types";

interface UseEmailsParams {
  priority?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface UseEmailsResult {
  emails: Email[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEmails(params: UseEmailsParams = {}): UseEmailsResult {
  const { priority, category, page = 1, limit = 20 } = params;
  const [emails, setEmails] = useState<Email[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchEmails() {
      setIsLoading(true);
      setError(null);

      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));
      if (priority) searchParams.set("priority", priority);
      if (category) searchParams.set("category", category);

      try {
        const res = await fetch(`/api/emails?${searchParams}`);
        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) { setEmails([]); setTotal(0); }
            return;
          }
          throw new Error("Failed to fetch emails");
        }
        const data = await res.json();
        if (!cancelled) {
          setEmails(data.emails);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchEmails();
    return () => { cancelled = true; };
  }, [priority, category, page, limit, refreshKey]);

  return { emails, total, isLoading, error, refetch };
}
