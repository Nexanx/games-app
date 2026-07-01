import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const statusLabels: Record<string, string> = {
  to_play: "Do ogrania",
  playing: "W trakcie",
  completed: "Ograna",
  abandoned: "Porzucona",
  paused: "Wstrzymana"
};

const statusStyles: Record<string, string> = {
  to_play: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  playing: "border-primary/35 bg-primary/10 text-primary",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  abandoned: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  paused: "border-amber-400/30 bg-amber-400/10 text-amber-200"
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn(statusStyles[status])}>{statusLabels[status] ?? status}</Badge>;
}

