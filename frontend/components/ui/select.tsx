import * as React from "react";

import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "min-h-11 w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/45",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

