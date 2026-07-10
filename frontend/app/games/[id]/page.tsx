import { redirect } from "next/navigation";

export default function LegacyGameDetailsPage({ params }: { params: { id: string } }) {
  redirect(`/completed-games/entry/${params.id}`);
}
