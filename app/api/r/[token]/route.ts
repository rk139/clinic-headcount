import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

function programLabel(programType: string) {
  if (programType === "RED_BALL") return "Clinic Session";
  return "Clinic Session";
}

function groupLabel(programType: string, level: number | null) {
  if (programType === "RED_BALL") return "Red Ball";
  return level ? `Level ${level}` : "Juniors";
}

function sessionStartMs(date: string, startTime: string) {
  // Local time assumption (fine for Phase 1)
  const d = new Date(`${date}T${startTime}:00`);
  return d.getTime();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
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

    // If you still want manual expiresAt support, keep this:
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "This link has expired" },
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

    const s = link.session;

    return NextResponse.json({
      ok: true,
      session: {
        dateLabel: formatDateLabel(s.date),
        timeLabel: `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`, // hyphen avoids weird encoding
        programLabel: programLabel(s.programType),
        groupLabel: groupLabel(s.programType, s.level),
        locationLabel: "Springside Athletic Club",
      },
    });
  } catch (err) {
    console.error("GET /api/r/[token] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}

