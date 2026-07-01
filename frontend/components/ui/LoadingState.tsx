import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Ładowanie danych" }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-3 rounded-lg border border-border bg-card/70 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

