import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateSeriesBody = {
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

export async function GET() {
  const currentUser = await getCurrentSession();

  if (!currentUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const series = await prisma.clinicSeries.findMany({
      orderBy: [
        {
          startDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
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

    return NextResponse.json(series);
  } catch (error) {
    console.error("Failed to load clinic series:", error);

    return NextResponse.json(
      { error: "Failed to load clinic series" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentSession();

  if (!currentUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as CreateSeriesBody;

    const name = cleanRequiredString(body.name);
    const programType = cleanRequiredString(body.programType);
    const level = cleanOptionalString(body.level);
    const startDate = cleanRequiredString(body.startDate);
    const endDate = cleanRequiredString(body.endDate);
    const registrationOpen = body.registrationOpen === true;

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

    const createdSeries = await prisma.clinicSeries.create({
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

    return NextResponse.json(createdSeries, {
      status: 201,
    });
  } catch (error) {
    console.error("Failed to create clinic series:", error);

    return NextResponse.json(
      { error: "Failed to create clinic series" },
      { status: 500 },
    );
  }
}