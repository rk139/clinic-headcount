import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DateTime } from "luxon";

function sessionStartMs(date: string, startTime: string) {
  const ZONE = "America/New_York";
  const dt = DateTime.fromISO(`${date}T${startTime}`, { zone: ZONE });
  return dt.isValid ? dt.toMillis() : NaN;
}

type Choice = "attending" | "not_attending";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = (await req.json().catch(() => null)) as
      | { choice?: Choice; kidNames?: unknown; familyCode?: unknown }
      | null;

    const choice = body?.choice;
    if (choice !== "attending" && choice !== "not_attending") {
      return NextResponse.json(
        { ok: false, error: "Invalid choice" },
        { status: 400 }
      );
    }

    const rawFamilyCode = body?.familyCode;
    const familyCode =
      typeof rawFamilyCode === "string"
        ? rawFamilyCode.trim().toUpperCase()
        : "";

    if (!familyCode) {
      return NextResponse.json(
        { ok: false, error: "Family Code is required" },
        { status: 400 }
      );
    }

    // LASTNAME + 2 digits (e.g., MILLER07)
    if (!/^[A-Z]{3,}\d{2}$/.test(familyCode)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Family Code must look like MILLER07 (LASTNAME + 2 digits).",
        },
        { status: 400 }
      );
    }

    const rawKidNames = body?.kidNames;

    // ✅ Fix 1: only allow kidNames when attending
    const kidNames =
      choice === "attending" && Array.isArray(rawKidNames)
        ? rawKidNames
            .filter((n): n is string => typeof n === "string")
            .map((n) => n.trim())
            .filter((n) => n.length > 0)
            .slice(0, 6)
        : [];

    if (choice === "attending" && kidNames.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Please enter at least one kid’s name." },
        { status: 400 }
      );
    }

    const link = await prisma.responseLink.findUnique({
      where: { token },
      include: {
        session: true,
      },
    });

    if (!link) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "This link has expired" },
        { status: 410 }
      );
    }

    if (link.closedAt) {
      return NextResponse.json(
        { ok: false, error: "This link is closed." },
        { status: 410 }
      );
    }

    const start = sessionStartMs(link.session.date, link.session.startTime);
    if (!Number.isNaN(start) && Date.now() >= start) {
      return NextResponse.json(
        { ok: false, error: "This link is closed (clinic has started)." },
        { status: 410 }
      );
    }

    const prev = await prisma.sessionResponse.findFirst({
      where: { linkId: link.id, familyCode },
      orderBy: { createdAt: "desc" },
    });

    const previousChoice = prev?.choice ?? null;
    const replaced = previousChoice !== null;

    const created = await prisma.sessionResponse.upsert({
        where: {
          linkId_familyCode: {
            linkId: link.id,
            familyCode,
          },
        },
        update: {
          choice,
          kidNames: kidNames.length ? kidNames : undefined,
        },
        create: {
          linkId: link.id,
          familyCode,
          choice,
          kidNames: kidNames.length ? kidNames : undefined,
        },
      });

    return NextResponse.json({
      ok: true,
      id: created.id,
      familyCode,
      choice: created.choice,
      kidNames: created.kidNames,
      replaced,
      previousChoice,
    });
  } catch (err) {
    console.error("POST /api/r/[token]/respond failed:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}






