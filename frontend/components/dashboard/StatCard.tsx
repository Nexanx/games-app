import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = "text-primary"
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-32 items-center gap-4 p-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted", accent)}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-tight">{value}</p>
          {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

