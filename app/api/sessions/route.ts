// app/api/sessions/route.ts
import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function normalizeKidNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function normName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normFamilyCode(familyCode: string | null) {
  return (familyCode ?? "").trim().toUpperCase();
}

function prettyFamily(familyCode: string) {
  const base = familyCode.replace(/\d{2}$/, "");

  if (!base) return familyCode;

  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

type Kid = {
  key: string;
  label: string;
};

export async function GET() {
  try {
    const currentSession = await getCurrentSession();

    if (!currentSession) {
      return NextResponse.json(
        { error: "Authentication required." },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (
      currentSession.role !== "ADMIN" &&
      currentSession.role !== "COACH"
    ) {
      return NextResponse.json(
        { error: "You do not have permission to access these sessions." },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // Return sessions for the next 14 days, including today.
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
            closedAt: true,
            responses: {
              select: {
                familyCode: true,
                choice: true,
                createdAt: true,
                kidNames: true,
              },
            },
          },
        },
      },
    });

    type Session = (typeof sessions)[number];

    const withTotals = sessions.map((session: Session) => {
      const responses = session.responseLink?.responses ?? [];

      // Keep only the latest response from each family.
      const latestByFamily = new Map<
        string,
        {
          familyCode: string | null;
          choice: string;
          createdAt: Date;
          kidNames: unknown;
        }
      >();

      let lastResponseAt: string | null = null;

      for (const response of responses) {
        const familyKey = normFamilyCode(response.familyCode);

        if (!familyKey) continue;

        const current = latestByFamily.get(familyKey);

        if (!current || response.createdAt > current.createdAt) {
          latestByFamily.set(familyKey, response);
        }

        const responseTime = response.createdAt.toISOString();

        if (!lastResponseAt || responseTime > lastResponseAt) {
          lastResponseAt = responseTime;
        }
      }

      const latestResponses = Array.from(latestByFamily.values());

      let attendingCount = 0;
      let notAttendingCount = 0;
      let attendingKidsCount = 0;
      let notAttendingKidsCount = 0;

      const attendingKidNames: string[] = [];
      const notAttendingKidNames: string[] = [];

      const attendingKids: Kid[] = [];
      const notAttendingKids: Kid[] = [];

      for (const response of latestResponses) {
        const names = normalizeKidNames(response.kidNames);
        const familyCode = normFamilyCode(response.familyCode);

        if (!familyCode) continue;

        if (response.choice === "attending") {
          attendingCount += 1;
          attendingKidsCount += names.length;

          for (const kidName of names) {
            const trimmedName = kidName.trim();

            attendingKidNames.push(trimmedName);
            attendingKids.push({
              key: `${familyCode}:${normName(trimmedName)}`,
              label: `${trimmedName} (${prettyFamily(familyCode)})`,
            });
          }
        } else if (response.choice === "not_attending") {
          notAttendingCount += 1;
          notAttendingKidsCount += names.length;

          for (const kidName of names) {
            const trimmedName = kidName.trim();

            notAttendingKidNames.push(trimmedName);
            notAttendingKids.push({
              key: `${familyCode}:${normName(trimmedName)}`,
              label: `${trimmedName} (${prettyFamily(familyCode)})`,
            });
          }
        }
      }

      return {
        ...session,

        responseLink: session.responseLink
          ? {
              token: session.responseLink.token,
              closedAt: session.responseLink.closedAt
                ? session.responseLink.closedAt.toISOString()
                : null,
            }
          : null,

        attendingCount,
        notAttendingCount,
        attendingKidsCount,
        notAttendingKidsCount,
        attendingKidNames,
        notAttendingKidNames,
        attendingKids,
        notAttendingKids,
        lastResponseAt,
      };
    });

    return NextResponse.json(withTotals, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/sessions failed:", error);

    return NextResponse.json(
      { error: "Failed to load sessions." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}






