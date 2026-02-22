import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"; // helps avoid any stale caching weirdness

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeKidNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((n): n is string => typeof n === "string")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

export async function GET() {
  try {
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
            closedAt: true,
            responses: {
              select: {
                familyCode: true, // ✅ Phase 1C: needed for dedupe
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

    const withTotals = sessions.map((s: Session) => {
      const responses = s.responseLink?.responses ?? [];

      // ✅ Phase 1C: keep only the latest response per familyCode
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

      for (const r of responses) {
        const key = (r.familyCode ?? "").trim().toUpperCase();
        if (!key) continue;

        const current = latestByFamily.get(key);
        if (!current || r.createdAt > current.createdAt) {
          latestByFamily.set(key, r);
        }

        const iso = r.createdAt.toISOString();
        if (!lastResponseAt || iso > lastResponseAt) lastResponseAt = iso;
      }

      const latestResponses = Array.from(latestByFamily.values());

      let attendingCount = 0;
      let notAttendingCount = 0;

      let attendingKidsCount = 0;
      let notAttendingKidsCount = 0;

      const attendingKidNames: string[] = [];
      const notAttendingKidNames: string[] = [];

      // ✅ Count only latest response per familyCode
      for (const r of latestResponses) {
        const names = normalizeKidNames(r.kidNames);

        if (r.choice === "attending") {
          attendingCount += 1;
          attendingKidsCount += names.length;
          attendingKidNames.push(...names);
        } else if (r.choice === "not_attending") {
          notAttendingCount += 1;
          notAttendingKidsCount += names.length;
          notAttendingKidNames.push(...names);
        }
      }

      return {
        ...s,

        // return token + closedAt (UI needs both)
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

    return NextResponse.json(withTotals, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/sessions failed:", err);

    // IMPORTANT: return JSON so the client never crashes on res.json()
    return NextResponse.json(
      { error: "Failed to load sessions" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}






