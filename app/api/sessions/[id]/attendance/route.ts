import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AttendanceRow = {
  attended?: unknown;
  kidName?: unknown;
  familyCode?: unknown;
};

function isAuthorizedRole(role: string) {
  return role === "ADMIN" || role === "COACH";
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const currentSession = await getCurrentSession();

    if (!currentSession) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!isAuthorizedRole(currentSession.role)) {
      return NextResponse.json(
        { error: "Coach or administrator access required." },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Invalid session ID." },
        { status: 400 },
      );
    }

    const rows = await prisma.sessionAttendance.findMany({
      where: {
        sessionId: id,
      },
      orderBy: {
        kidName: "asc",
      },
    });

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "GET /api/sessions/[id]/attendance failed:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to load attendance." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const currentSession = await getCurrentSession();

    if (!currentSession) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!isAuthorizedRole(currentSession.role)) {
      return NextResponse.json(
        { error: "Coach or administrator access required." },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Invalid session ID." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      !("attendance" in body) ||
      typeof body.attendance !== "object" ||
      body.attendance === null ||
      Array.isArray(body.attendance)
    ) {
      return NextResponse.json(
        { error: "Invalid attendance data." },
        { status: 400 },
      );
    }

    const attendance = body.attendance as Record<
      string,
      AttendanceRow
    >;

    const updates = Object.entries(attendance).map(
      ([kidKey, row]) => {
        const trimmedKidKey = kidKey.trim();
        const kidName =
          typeof row.kidName === "string"
            ? row.kidName.trim()
            : "";

        const familyCode =
          typeof row.familyCode === "string" &&
          row.familyCode.trim()
            ? row.familyCode.trim().toUpperCase()
            : null;

        if (!trimmedKidKey || !kidName) {
          throw new Error("Invalid attendance row.");
        }

        return prisma.sessionAttendance.upsert({
          where: {
            sessionId_kidKey: {
              sessionId: id,
              kidKey: trimmedKidKey,
            },
          },
          update: {
            attended: row.attended === true,
            kidName,
            familyCode,
          },
          create: {
            sessionId: id,
            kidKey: trimmedKidKey,
            kidName,
            familyCode,
            attended: row.attended === true,
          },
        });
      },
    );

    await prisma.$transaction(updates);

    return NextResponse.json({
      success: true,
      updatedRows: updates.length,
    });
  } catch (error) {
    console.error(
      "POST /api/sessions/[id]/attendance failed:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Invalid attendance row."
    ) {
      return NextResponse.json(
        { error: "Every attendance row requires a kid key and name." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to save attendance." },
      { status: 500 },
    );
  }
}