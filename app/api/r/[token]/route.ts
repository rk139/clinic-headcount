import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DateTime } from "luxon";

function formatTime(hhmm: string) {
  const [hhStr, mmStr] = hhmm.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);

  if (Number.isNaN(hh) || Number.isNaN(mm)) return hhmm;

  const suffix = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const mm2 = String(mm).padStart(2, "0");
  return `${hour12}:${mm2} ${suffix}`;
}

function formatDateLabel(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function programLabel(_programType: string) {
  return "Clinic Session";
}

function groupLabel(programType: string, level: string | null) {
  if (programType === "RED_BALL") return "Red Ball";
  return level ? `Level ${level}` : "Juniors";
}

function sessionStartMs(date: string, startTime: string) {
   const ZONE = "America/New_York";
   const dt = DateTime.fromISO(`${date}T${startTime}`, { zone: ZONE });
   return dt.isValid ? dt.toMillis() : NaN;
}

type Choice = "attending" | "not_attending";

function normalizeKidNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((n): n is string => typeof n === "string")
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .slice(0, 6);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // ✅ Optional: familyCode query param
    const url = new URL(req.url);
    const rawFamilyCode = url.searchParams.get("familyCode") ?? "";
    const familyCode = rawFamilyCode.trim().toUpperCase();

    const link = await prisma.responseLink.findUnique({
      where: { token },
      include: { session: true },
    });

    if (!link) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Optional expiresAt support
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "This link has expired" },
        { status: 410 }
      );
    }

    // ✅ manual close support
    if (link.closedAt) {
      return NextResponse.json(
        { ok: false, error: "This link is closed." },
        { status: 410 }
      );
    }

    // Close at clinic start time
    const start = sessionStartMs(link.session.date, link.session.startTime);
    if (!Number.isNaN(start) && Date.now() >= start) {
      return NextResponse.json(
        { ok: false, error: "This link is closed (clinic has started)." },
        { status: 410 }
      );
    }

    // ✅ If familyCode is provided, return latest response for THAT family
    let currentChoice: Choice | null = null;
    let currentKidNames: string[] = [];

    if (familyCode) {
      const latest = await prisma.sessionResponse.findFirst({
        where: { linkId: link.id, familyCode },
        orderBy: { createdAt: "desc" },
        select: { choice: true, kidNames: true },
      });

      if (latest?.choice === "attending" || latest?.choice === "not_attending") {
        currentChoice = latest.choice;
      }

      currentKidNames = normalizeKidNames(latest?.kidNames);
    }

    const s = link.session;

    return NextResponse.json({
      ok: true,
      session: {
        dateLabel: formatDateLabel(s.date),
        timeLabel: `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`,
        programLabel: programLabel(s.programType),
        groupLabel: groupLabel(s.programType, s.level),
        locationLabel: "Springside Athletic Club",
      },
      currentChoice,
      currentKidNames,
    });
  } catch (err) {
    console.error("GET /api/r/[token] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}

