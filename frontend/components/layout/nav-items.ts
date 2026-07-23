import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheckBig,
  DatabaseBackup,
  Gamepad2,
  Gem,
  LayoutDashboard,
  MessageCircle
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/backlog", label: "Do ogrania", icon: Gamepad2 },
  { href: "/completed-games", label: "Ukończone", icon: CircleCheckBig },
  { href: "/poe", label: "Path of Exile", icon: Gem },
  { href: "/analytics", label: "Analizy", icon: ChartNoAxesCombined },
  { href: "/releases", label: "Premiery", icon: CalendarDays },
  { href: "/chatbot", label: "Chatbot", icon: MessageCircle },
  { href: "/backup", label: "Kopia danych", icon: DatabaseBackup }
] as const;

export const navGroups = [
  { label: "Główne", items: navItems.slice(0, 4) },
  { label: "Statystyki", items: navItems.slice(4, 5) },
  { label: "Dodatkowe", items: navItems.slice(5) }
] as const;

export const mobilePrimaryItems = navItems.slice(0, 4);
export const mobileMoreGroups = navGroups.slice(1);

export function isNavItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
