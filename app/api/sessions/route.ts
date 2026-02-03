import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  // Return sessions for the next 14 days (including today)
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 14);

  const toYMD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const sessions = await prisma.clinicSession.findMany({
    where: {
      date: {
        gte: toYMD(start),
        lt: toYMD(end),
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: {
      responseLink: {
        select: {
          token: true,
          closedAt: true, // ✅ Step 6: include closed state for UI
          responses: {
            select: {
              choice: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  // ✅ derive the element type safely (Prisma v6 friendly)
  type Session = (typeof sessions)[number];

  const withTotals = sessions.map((s: Session) => {
    const responses = s.responseLink?.responses ?? [];

    let attendingCount = 0;
    let notAttendingCount = 0;
    let lastResponseAt: string | null = null;

    for (const r of responses) {
      if (r.choice === "attending") attendingCount += 1;
      if (r.choice === "not_attending") notAttendingCount += 1;

      const iso = r.createdAt.toISOString();
      if (!lastResponseAt || iso > lastResponseAt) {
        lastResponseAt = iso;
      }
    }

    return {
      ...s,

      // ✅ return token + closedAt (UI needs both)
      responseLink: s.responseLink
        ? {
            token: s.responseLink.token,
            closedAt: s.responseLink.closedAt
              ? s.responseLink.closedAt.toISOString()
              : null,
          }
        : null,

      attendingCount,
      notAttendingCount,
      lastResponseAt,
    };
  });

  return NextResponse.json(withTotals);
}





