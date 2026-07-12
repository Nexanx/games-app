import { BarChart3, CalendarCheck2, ChartNoAxesCombined, Gamepad2, Gem, MessageCircle } from "lucide-react";

export const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/completed-games", label: "Ukończone", icon: CalendarCheck2 },
  { href: "/analytics", label: "Analizy", icon: ChartNoAxesCombined },
  { href: "/backlog", label: "Do ogrania", icon: Gamepad2 },
  { href: "/poe", label: "Path of Exile", icon: Gem },
  { href: "/chatbot", label: "Chatbot", icon: MessageCircle }
];
