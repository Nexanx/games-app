import { cn } from "@/lib/utils";

export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="15" fill="#0d1724" />
      <path
        d="M18.5 19.5h27c4.1 0 7.7 2.8 8.7 6.8l3.4 13.3c1.2 4.8-2.4 9.4-7.3 9.4-2.2 0-4.2-1-5.6-2.7L41 41.8H23l-3.7 4.5c-1.4 1.7-3.4 2.7-5.6 2.7-4.9 0-8.5-4.6-7.3-9.4l3.4-13.3c1-4 4.6-6.8 8.7-6.8Z"
        fill="#101f2d"
        stroke="#d8a34b"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M15.5 32h9M20 27.5v9" fill="none" stroke="#29c794" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M35 35v-4m5 4v-7m5 7V25" fill="none" stroke="#29c794" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
