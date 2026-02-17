import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

//const prisma = new PrismaClient();

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeKidNames(value: unknown): string[] {
  // kidNames is Json? so it can be null/undefined/array/etc.
  if (!Array.isArray(value)) return [];
  return value
    .filter((n): n is string => typeof n === "string")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

export async function GET() {
  // Return sessions for the next 14 days (including today)
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 14);

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
              kidNames: true, // ✅ NEW
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

    // ✅ NEW: counts based on number of kids listed
    let attendingKidsCount = 0;
    let notAttendingKidsCount = 0;

    // ✅ NEW: flattened name lists
    const attendingKidNames: string[] = [];
    const notAttendingKidNames: string[] = [];

    let lastResponseAt: string | null = null;

    for (const r of responses) {
      const names = normalizeKidNames(r.kidNames);

      if (r.choice === "attending") {
        attendingCount += 1;
        attendingKidsCount += names.length;
        attendingKidNames.push(...names);
      }

      if (r.choice === "not_attending") {
        notAttendingCount += 1;
        notAttendingKidsCount += names.length;
        notAttendingKidNames.push(...names);
      }

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
      attendingKidsCount,
      notAttendingKidsCount,
      attendingKidNames,
      notAttendingKidNames,
      lastResponseAt,
    };
  });

  return NextResponse.json(withTotals);
}






