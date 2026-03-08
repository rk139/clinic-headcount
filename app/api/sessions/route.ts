// app/api/sessions/route.ts
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

//  NEW helpers
function normName(n: string) {
  return n.trim().toLowerCase().replace(/\s+/g, " ");
}

function normFamilyCode(fc: string | null) {
  return (fc ?? "").trim().toUpperCase();
}

function prettyFamily(fc: string) {
    const base = fc.replace(/\d{2}$/, ""); // remove last two digits
    if (!base) return fc;
    return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  }

type Kid = { key: string; label: string };


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
                familyCode: true, //  Phase 1C: needed for dedupe
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

      //  Phase 1C: keep only the latest response per familyCode
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
        const key = normFamilyCode(r.familyCode);
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

      // Old fields (keep for backward compatibility)
      const attendingKidNames: string[] = [];
      const notAttendingKidNames: string[] = [];

      //  NEW fields: include familyCode-based kid keys + display labels
      const attendingKids: Kid[] = [];
      const notAttendingKids: Kid[] = [];

      //  Count only latest response per familyCode
      for (const r of latestResponses) {
        const names = normalizeKidNames(r.kidNames);
        const fc = normFamilyCode(r.familyCode);
        if (!fc) continue;

        if (r.choice === "attending") {
          attendingCount += 1;
          attendingKidsCount += names.length;

          for (const kidName of names) {
            const key = `${fc}:${normName(kidName)}`;
            const label = `${kidName.trim()} (${prettyFamily(fc)})`;

            attendingKidNames.push(kidName.trim());
            attendingKids.push({ key, label });
          }
        } else if (r.choice === "not_attending") {
          notAttendingCount += 1;
          notAttendingKidsCount += names.length;

          for (const kidName of names) {
            const key = `${fc}:${normName(kidName)}`;
            const label = `${kidName.trim()} (${prettyFamily(fc)})`;

            notAttendingKidNames.push(kidName.trim());
            notAttendingKids.push({ key, label });
          }
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

        // old arrays (still returned)
        attendingKidNames,
        notAttendingKidNames,

        //  new arrays (use these on /headcount)
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
  } catch (err) {
    console.error("GET /api/sessions failed:", err);

    // IMPORTANT: return JSON so the client never crashes on res.json()
    return NextResponse.json(
      { error: "Failed to load sessions" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}






