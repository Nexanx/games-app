"use client";

import { useEffect, useState } from "react";

import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { api } from "@/services/api";
import type { DashboardSummary } from "@/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    api.dashboard(controller.signal)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((cause) => {
        if (active && !(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Nie udało się pobrać Dashboardu.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [retryKey]);

  if (loading && !summary) return <LoadingState label="Ładowanie Dashboardu" />;
  if (!summary) return <div className="space-y-3"><ErrorState message={error ?? "Nie udało się pobrać Dashboardu."} /><Button type="button" variant="secondary" onClick={() => setRetryKey((value) => value + 1)}>Spróbuj ponownie</Button></div>;

  return <div className="space-y-8">
    {error ? <ErrorState message={error} /> : null}
    <DashboardContent summary={summary} />
  </div>;
}
