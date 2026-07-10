import { BarChart3, CalendarCheck2, Gamepad2, Gem, MessageCircle, Settings } from "lucide-react";

export const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/completed-games", label: "Ukończone", icon: CalendarCheck2 },
  { href: "/backlog", label: "Do ogrania", icon: Gamepad2 },
  { href: "/poe", label: "Path of Exile", icon: Gem },
  { href: "/chatbot", label: "Chatbot", icon: MessageCircle },
  { href: "/settings", label: "Ustawienia", icon: Settings }
];
