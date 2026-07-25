import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return <HistoryClient role={session.role} />;
}