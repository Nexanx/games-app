"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/LoadingState";
import { currentCompletedGamesYear } from "@/lib/completed-games";

export default function AnalyticsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/analytics/${currentCompletedGamesYear()}`);
  }, [router]);

  return <LoadingState label="Otwieranie analiz bieżącego roku" />;
}
