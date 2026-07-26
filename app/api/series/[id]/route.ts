import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateSeriesBody = {
  name?: unknown;
  programType?: unknown;
  level?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  registrationOpen?: unknown;
};

function cleanRequiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

async function requireAdmin() {
  const currentUser = await getCurrentSession();

  if (!currentUser) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  if (currentUser.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      ),
    };
  }

  return {
    currentUser,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateSeriesBody;

    const existingSeries = await prisma.clinicSeries.findUnique({
      where: {
        id,
      },
    });

    if (!existingSeries) {
      return NextResponse.json(
        { error: "Clinic series not found" },
        { status: 404 },
      );
    }

    const name =
      body.name === undefined
        ? existingSeries.name
        : cleanRequiredString(body.name);

    const programType =
      body.programType === undefined
        ? existingSeries.programType
        : cleanRequiredString(body.programType);

    const level =
      body.level === undefined
        ? existingSeries.level
        : cleanOptionalString(body.level);

    const startDate =
      body.startDate === undefined
        ? existingSeries.startDate
        : cleanRequiredString(body.startDate);

    const endDate =
      body.endDate === undefined
        ? existingSeries.endDate
        : cleanRequiredString(body.endDate);

    const registrationOpen =
      body.registrationOpen === undefined
        ? existingSeries.registrationOpen
        : body.registrationOpen === true;

    if (!name) {
      return NextResponse.json(
        { error: "Series name is required" },
        { status: 400 },
      );
    }

    if (!programType) {
      return NextResponse.json(
        { error: "Program type is required" },
        { status: 400 },
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 },
      );
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { error: "End date cannot be before start date" },
        { status: 400 },
      );
    }

    const updatedSeries = await prisma.clinicSeries.update({
      where: {
        id,
      },
      data: {
        name,
        programType,
        level,
        startDate,
        endDate,
        registrationOpen,
      },
      include: {
        registrationLink: {
          select: {
            token: true,
            closedAt: true,
            expiresAt: true,
          },
        },
        _count: {
          select: {
            sessions: true,
            registrations: true,
          },
        },
      },
    });

    return NextResponse.json(updatedSeries);
  } catch (error) {
    console.error("Failed to update clinic series:", error);

    return NextResponse.json(
      { error: "Failed to update clinic series" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { id } = await context.params;

    const existingSeries = await prisma.clinicSeries.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            sessions: true,
            registrations: true,
          },
        },
      },
    });

    if (!existingSeries) {
      return NextResponse.json(
        { error: "Clinic series not found" },
        { status: 404 },
      );
    }

    if (
      existingSeries._count.sessions > 0 ||
      existingSeries._count.registrations > 0
    ) {
      return NextResponse.json(
        {
          error:
            "This series cannot be deleted while it still has sessions or registrations.",
        },
        { status: 409 },
      );
    }

    await prisma.clinicSeries.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to delete clinic series:", error);

    return NextResponse.json(
      { error: "Failed to delete clinic series" },
      { status: 500 },
    );
  }
}