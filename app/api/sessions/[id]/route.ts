import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireAdmin() {
  const currentSession = await getCurrentSession();

  if (!currentSession) {
    return {
      error: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  if (currentSession.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 },
      ),
    };
  }

  return { currentSession };
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeString(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const existingSession = await prisma.clinicSession.findUnique({
      where: { id },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    const updateData: {
      date?: string;
      startTime?: string;
      endTime?: string;
      programType?: string;
      level?: string | null;
      capacity?: number;
      fullSessionCount?: number;
      makeUpCount?: number;
      singleDateCount?: number;
    } = {};

    if ("date" in body) {
      const date = String(body.date).trim();

      if (!isValidDateString(date)) {
        return NextResponse.json(
          { error: "Date must use YYYY-MM-DD format." },
          { status: 400 },
        );
      }

      updateData.date = date;
    }

    if ("startTime" in body) {
      const startTime = String(body.startTime).trim();

      if (!isValidTimeString(startTime)) {
        return NextResponse.json(
          { error: "Start time must use HH:MM format." },
          { status: 400 },
        );
      }

      updateData.startTime = startTime;
    }

    if ("endTime" in body) {
      const endTime = String(body.endTime).trim();

      if (!isValidTimeString(endTime)) {
        return NextResponse.json(
          { error: "End time must use HH:MM format." },
          { status: 400 },
        );
      }

      updateData.endTime = endTime;
    }

    const finalStartTime =
      updateData.startTime ?? existingSession.startTime;

    const finalEndTime =
      updateData.endTime ?? existingSession.endTime;

    if (finalStartTime >= finalEndTime) {
      return NextResponse.json(
        { error: "End time must be later than start time." },
        { status: 400 },
      );
    }

    if ("programType" in body) {
      const programType = String(body.programType).trim();

      if (!programType) {
        return NextResponse.json(
          { error: "Program type is required." },
          { status: 400 },
        );
      }

      updateData.programType = programType;
    }

    if ("level" in body) {
      const level =
        body.level === null
          ? null
          : String(body.level).trim() || null;

      updateData.level = level;
    }

    if ("capacity" in body) {
      const capacity = Number(body.capacity);

      if (
        !Number.isInteger(capacity) ||
        capacity < 1
      ) {
        return NextResponse.json(
          { error: "Capacity must be a whole number greater than zero." },
          { status: 400 },
        );
      }

      updateData.capacity = capacity;
    }

    if ("fullSessionCount" in body) {
      const fullSessionCount = Number(body.fullSessionCount);

      if (
        !Number.isInteger(fullSessionCount) ||
        fullSessionCount < 0
      ) {
        return NextResponse.json(
          { error: "Full session count must be zero or greater." },
          { status: 400 },
        );
      }

      updateData.fullSessionCount = fullSessionCount;
    }

    if ("makeUpCount" in body) {
      const makeUpCount = Number(body.makeUpCount);

      if (
        !Number.isInteger(makeUpCount) ||
        makeUpCount < 0
      ) {
        return NextResponse.json(
          { error: "Make-up count must be zero or greater." },
          { status: 400 },
        );
      }

      updateData.makeUpCount = makeUpCount;
    }

    if ("singleDateCount" in body) {
      const singleDateCount = Number(body.singleDateCount);

      if (
        !Number.isInteger(singleDateCount) ||
        singleDateCount < 0
      ) {
        return NextResponse.json(
          { error: "Single-date count must be zero or greater." },
          { status: 400 },
        );
      }

      updateData.singleDateCount = singleDateCount;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields were provided." },
        { status: 400 },
      );
    }

    const updated = await prisma.clinicSession.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/sessions/[id] failed:", error);

    return NextResponse.json(
      { error: "Failed to update session." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    const session = await prisma.clinicSession.findUnique({
      where: { id },
      include: {
        responseLink: {
          include: {
            _count: {
              select: {
                responses: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendances: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    const attendanceCount = session._count.attendances;
    const responseCount =
      session.responseLink?._count.responses ?? 0;

    const hasExistingData =
      attendanceCount > 0 || responseCount > 0;

    if (hasExistingData && !force) {
      return NextResponse.json(
        {
          error: "This session contains existing data.",
          requiresConfirmation: true,
          attendanceCount,
          responseCount,
        },
        { status: 409 },
      );
    }

    await prisma.clinicSession.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deletedSessionId: id,
    });
  } catch (error) {
    console.error("DELETE /api/sessions/[id] failed:", error);

    return NextResponse.json(
      { error: "Failed to delete session." },
      { status: 500 },
    );
  }
}

