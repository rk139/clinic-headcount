import CoachBoard from "./CoachBoard";

export type Session = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  programType: string;
  level: number | null;
  attendingKidsCount?: number;
  attendingKidNames?: string[];
};

async function getSessions(): Promise<Session[]> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/sessions`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to load sessions");
  }

  return res.json();
}

export default async function CoachPage() {
  const sessions = await getSessions();

  const today = new Date().toISOString().split("T")[0];
  const todaysSessions = sessions.filter((s) => s.date === today);

  return <CoachBoard sessions={todaysSessions} />;
}