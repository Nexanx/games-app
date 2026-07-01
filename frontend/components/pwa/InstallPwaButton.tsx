"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallPwaButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) {
      return;
    }
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (installed) {
    return <p className="text-sm text-muted-foreground">Aplikacja jest zainstalowana na tym urządzeniu.</p>;
  }

  return (
    <Button onClick={install} disabled={!installEvent} variant="secondary">
      <Download className="h-4 w-4" aria-hidden="true" />
      Zainstaluj PWA
    </Button>
  );
}

