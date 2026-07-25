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

function formatTime(hhmm: string) {
  const [hourString, minuteString] = hhmm.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return hhmm;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const paddedMinute = String(minute).padStart(2, "0");

  return `${hour12}:${paddedMinute} ${suffix}`;
}

function formatDateLabel(date: string) {
  const parsedDate = DateTime.fromISO(date, {
    zone: TIME_ZONE,
  });

  if (!parsedDate.isValid) {
    return date;
  }

  return parsedDate.toLocaleString({
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function programLabel(_programType: string) {
  return "Clinic Session";
}

function groupLabel(
  programType: string,
  level: string | null,
) {
  if (programType === "RED_BALL") {
    return "Red Ball";
  }

  return level ? `Level ${level}` : "Juniors";
}

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

export async function GET(
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
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const url = new URL(request.url);

    const familyCode = (
      url.searchParams.get("familyCode") ?? ""
    )
      .trim()
      .toUpperCase();

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
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        },
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
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (link.closedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "This link is closed.",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
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
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    let currentChoice: Choice | null = null;
    let currentKidNames: string[] = [];

    if (familyCode) {
      const latestResponse =
        await prisma.sessionResponse.findFirst({
          where: {
            linkId: link.id,
            familyCode,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            choice: true,
            kidNames: true,
          },
        });

      if (
        latestResponse?.choice === "attending" ||
        latestResponse?.choice === "not_attending"
      ) {
        currentChoice = latestResponse.choice;
      }

      currentKidNames = normalizeKidNames(
        latestResponse?.kidNames,
      );
    }

    const session = link.session;

    return NextResponse.json(
      {
        ok: true,
        session: {
          dateLabel: formatDateLabel(session.date),
          timeLabel: `${formatTime(session.startTime)} - ${formatTime(
            session.endTime,
          )}`,
          programLabel: programLabel(session.programType),
          groupLabel: groupLabel(
            session.programType,
            session.level,
          ),
          locationLabel: "Springside Athletic Club",
        },
        currentChoice,
        currentKidNames,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/r/[token] failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load the response link.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

