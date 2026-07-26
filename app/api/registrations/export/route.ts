import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).replace(/\r?\n/g, " ");

  return `"${text.replace(/"/g, '""')}"`;
}

function formatDateTime(value: Date): string {
  return value.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeFilenamePart(value: string): string {
  const cleanedValue = value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanedValue || "registrations";
}

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          error: "Admin access is required.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const url = new URL(request.url);

    const seriesId = (
      url.searchParams.get("seriesId") ?? ""
    ).trim();

    const search = (
      url.searchParams.get("search") ?? ""
    ).trim();

    const registrations =
      await prisma.registration.findMany({
        where: {
          ...(seriesId
            ? {
                seriesId,
              }
            : {}),

          ...(search
            ? {
                OR: [
                  {
                    childName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    parentName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    parentPhone: {
                      contains: search,
                    },
                  },
                  {
                    parentEmail: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    familyCode: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },

        select: {
          childName: true,

          parentName: true,
          parentPhone: true,
          parentEmail: true,

          emergencyContactName: true,
          emergencyContactPhone: true,

          birthDate: true,
          medicalNotes: true,
          familyCode: true,

          qrToken: true,
          registrationMethod: true,
          status: true,

          createdAt: true,

          series: {
            select: {
              name: true,
              programType: true,
              level: true,
              startDate: true,
              endDate: true,
            },
          },

          _count: {
            select: {
              attendanceConfirmations: true,
              checkIns: true,
            },
          },
        },

        orderBy: [
          {
            series: {
              startDate: "asc",
            },
          },
          {
            childName: "asc",
          },
        ],
      });

    const headers = [
      "Clinic Series",
      "Program",
      "Level",
      "Series Start",
      "Series End",
      "Child Name",
      "Birth Date",
      "Parent Name",
      "Parent Phone",
      "Parent Email",
      "Emergency Contact",
      "Emergency Phone",
      "Medical Notes",
      "Family Code",
      "Registration Status",
      "Registration Method",
      "Attendance Dates",
      "Check-Ins",
      "QR Token",
      "Registered At",
    ];

    const rows = registrations.map((registration) => [
      registration.series.name,
      registration.series.programType,
      registration.series.level,
      registration.series.startDate,
      registration.series.endDate,

      registration.childName,
      registration.birthDate,

      registration.parentName,
      registration.parentPhone,
      registration.parentEmail,

      registration.emergencyContactName,
      registration.emergencyContactPhone,

      registration.medicalNotes,
      registration.familyCode,

      registration.status,
      registration.registrationMethod,

      registration._count.attendanceConfirmations,
      registration._count.checkIns,

      registration.qrToken,
      formatDateTime(registration.createdAt),
    ]);

    const csv = [
      headers.map(csvCell).join(","),
      ...rows.map((row) =>
        row.map(csvCell).join(","),
      ),
    ].join("\r\n");

    let filename = "clinic-registrations";

    if (seriesId) {
      const selectedSeries =
        await prisma.clinicSeries.findUnique({
          where: {
            id: seriesId,
          },
          select: {
            name: true,
          },
        });

      if (selectedSeries) {
        filename = safeFilenamePart(
          selectedSeries.name,
        );
      }
    }

    const today = new Date()
      .toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      })
      .replace(/\//g, "-");

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type":
          "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}-${today}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "GET /api/registrations/export failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to export registrations.",
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