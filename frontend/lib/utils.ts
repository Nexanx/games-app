import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes = 0) {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return `${hours}h ${rest}min`;
}

export function splitList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function asDate(value?: string | null) {
  if (!value) {
    return "Brak daty";
  }
  return new Intl.DateTimeFormat("pl-PL").format(new Date(value));
}

