import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "America/New_York";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type Choice = "attending" | "not_attending";

type RequestBody = {
  choice?: unknown;
  kidNames?: unknown;
  familyCode?: unknown;
};

function sessionStartMs(date: string, startTime: string) {
  const dateTime = DateTime.fromISO(`${date}T${startTime}`, {
    zone: TIME_ZONE,
  });

  return dateTime.isValid ? dateTime.toMillis() : Number.NaN;
}

function normalizeKidNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .slice(0, 6);
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { token } = await context.params;
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid response link.",
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | RequestBody
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const choice = body.choice;

    if (choice !== "attending" && choice !== "not_attending") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid choice.",
        },
        { status: 400 },
      );
    }

    const familyCode =
      typeof body.familyCode === "string"
        ? body.familyCode.trim().toUpperCase()
        : "";

    if (!familyCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "Family Code is required.",
        },
        { status: 400 },
      );
    }

    if (!/^[A-Z]{3,}\d{2}$/.test(familyCode)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Family Code must look like MILLER07 (last name plus 2 digits).",
        },
        { status: 400 },
      );
    }

    const kidNames = normalizeKidNames(body.kidNames);

    if (choice === "attending" && kidNames.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter at least one kid’s name.",
        },
        { status: 400 },
      );
    }

    const link = await prisma.responseLink.findUnique({
      where: {
        token: trimmedToken,
      },
      include: {
        session: true,
      },
    });

    if (!link) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid or expired link.",
        },
        { status: 404 },
      );
    }

    if (
      link.expiresAt &&
      link.expiresAt.getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "This link has expired.",
        },
        { status: 410 },
      );
    }

    if (link.closedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "This link is closed.",
        },
        { status: 410 },
      );
    }

    const sessionStart = sessionStartMs(
      link.session.date,
      link.session.startTime,
    );

    if (
      !Number.isNaN(sessionStart) &&
      Date.now() >= sessionStart
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "This link is closed because the clinic has started.",
        },
        { status: 410 },
      );
    }

    const savedResponse = await prisma.sessionResponse.upsert({
      where: {
        linkId_familyCode: {
          linkId: link.id,
          familyCode,
        },
      },
      update: {
        choice,
        kidNames,
      },
      create: {
        linkId: link.id,
        familyCode,
        choice,
        kidNames,
      },
    });

    return NextResponse.json({
      ok: true,
      id: savedResponse.id,
      familyCode,
      choice: savedResponse.choice,
      kidNames: savedResponse.kidNames,
    });
  } catch (error) {
    console.error(
      "POST /api/r/[token]/respond failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to save response.",
      },
      { status: 500 },
    );
  }
}






