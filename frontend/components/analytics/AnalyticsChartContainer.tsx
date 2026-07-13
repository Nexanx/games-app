"use client";

import type { ComponentProps } from "react";
import { ResponsiveContainer as RechartsResponsiveContainer } from "recharts";

export function ResponsiveContainer(props: ComponentProps<typeof RechartsResponsiveContainer>) {
  return <RechartsResponsiveContainer initialDimension={{ width: 320, height: 288 }} {...props} />;
}
