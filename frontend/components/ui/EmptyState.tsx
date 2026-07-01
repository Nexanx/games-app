import { Inbox } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
        <Inbox className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

