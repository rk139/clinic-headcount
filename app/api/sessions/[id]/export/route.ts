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

function isAuthorizedRole(role: string) {
  return role === "ADMIN" || role === "COACH";
}

function escapeCsvValue(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function formatProgramType(programType: string) {
  if (programType === "RED_BALL") {
    return "Red Ball";
  }

  if (programType === "JUNIORS") {
    return "Juniors";
  }

  return programType;
}

function createFilename(
  date: string,
  programType: string,
  level: string | null,
) {
  const program =
    programType === "RED_BALL"
      ? "red-ball"
      : programType.toLowerCase().replace(/_/g, "-");

  const levelPart = level
    ? `-level-${level.replace(/\//g, "-")}`
    : "";

  return `${date}-${program}${levelPart}-attendance.csv`;
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

    const clinicSession = await prisma.clinicSession.findUnique({
      where: {
        id,
      },
      include: {
        attendances: {
          orderBy: {
            kidName: "asc",
          },
        },
      },
    });

    if (!clinicSession) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    const headers = [
      "Kid Name",
      "Family Code",
      "Attended",
      "Session Date",
      "Start Time",
      "End Time",
      "Program",
      "Level",
      "Capacity",
      "Attendance Added",
    ];

    const rows = clinicSession.attendances.map((attendance) => [
      attendance.kidName,
      attendance.familyCode ?? "",
      attendance.attended ? "Yes" : "No",
      clinicSession.date,
      clinicSession.startTime,
      clinicSession.endTime,
      formatProgramType(clinicSession.programType),
      clinicSession.level ?? "",
      clinicSession.capacity,
      attendance.createdAt.toISOString(),
    ]);

    const csvLines = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) =>
        row.map(escapeCsvValue).join(","),
      ),
    ];

    const csv = `\uFEFF${csvLines.join("\r\n")}`;

    const filename = createFilename(
      clinicSession.date,
      clinicSession.programType,
      clinicSession.level,
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "GET /api/sessions/[id]/export failed:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to export attendance." },
      { status: 500 },
    );
  }
}