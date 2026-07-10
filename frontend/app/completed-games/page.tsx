"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/LoadingState";
import { currentCompletedGamesYear } from "@/lib/completed-games";

/** Redirect the primary history tab to the browser's current calendar year. */
export default function CompletedGamesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/completed-games/${currentCompletedGamesYear()}`);
  }, [router]);

  return <LoadingState label="Otwieranie historii bieżącego roku" />;
}
