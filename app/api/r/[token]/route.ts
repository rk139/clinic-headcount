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

function formatDateLabel(date: string) {
  const parsedDate = DateTime.fromISO(date, {
    zone: TIME_ZONE,
  });

  if (!parsedDate.isValid) {
    return date;
  }

  return parsedDate.toLocaleString({
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function programLabel(
  programType: string,
  level: string | null,
) {
  if (programType === "RED_BALL") {
    return "Red Ball";
  }

  if (programType === "JUNIORS" && level) {
    return `Juniors Level ${level}`;
  }

  if (programType === "JUNIORS") {
    return "Juniors";
  }

  return programType;
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { token } = await context.params;
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid registration link.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const link = await prisma.registrationLink.findUnique({
      where: {
        token: trimmedToken,
      },
      include: {
        series: true,
      },
    });

    if (!link) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid registration link.",
        },
        {
          status: 404,
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
          error: "This registration link is closed.",
        },
        {
          status: 410,
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
          error: "This registration link has expired.",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!link.series.registrationOpen) {
      return NextResponse.json(
        {
          ok: false,
          error: "Registration for this clinic series is closed.",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        series: {
          id: link.series.id,
          name: link.series.name,
          programType: link.series.programType,
          programLabel: programLabel(
            link.series.programType,
            link.series.level,
          ),
          level: link.series.level,
          startDate: link.series.startDate,
          endDate: link.series.endDate,
          startDateLabel: formatDateLabel(
            link.series.startDate,
          ),
          endDateLabel: formatDateLabel(
            link.series.endDate,
          ),
          locationLabel: "Springside Athletic Club",
        },
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
        error: "Failed to load the registration link.",
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

