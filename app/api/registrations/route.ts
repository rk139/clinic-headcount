import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const registrations = await prisma.registration.findMany({
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
        id: true,
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
        updatedAt: true,

        series: {
          select: {
            id: true,
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
          createdAt: "desc",
        },
        {
          childName: "asc",
        },
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        registrations: registrations.map((registration) => ({
          ...registration,
          createdAt: registration.createdAt.toISOString(),
          updatedAt: registration.updatedAt.toISOString(),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/registrations failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load registrations.",
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