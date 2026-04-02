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

export default function CoachPage() {
  return <CoachBoard sessions={[]} />;
}