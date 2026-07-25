import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import CoachBoard from "./CoachBoard";

export type Session = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  programType: string;
  level: string | null;
  attendingKidsCount?: number;
  attendingKidNames?: string[];
};

export default async function CoachPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return <CoachBoard sessions={[]} role={session.role} />;
}