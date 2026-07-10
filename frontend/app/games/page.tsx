import { redirect } from "next/navigation";

export default function LegacyGamesPage() {
  redirect("/completed-games");
}
