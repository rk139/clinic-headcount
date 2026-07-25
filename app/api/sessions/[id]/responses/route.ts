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

function normalizeName(value: unknown) {
  return String(value ?? "").trim();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(normalizeName).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map(normalizeName).filter(Boolean);
      }
    } catch {
      // Ignore invalid JSON.
    }
  }

  return [];
}

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

    const link = await prisma.responseLink.findUnique({
      where: {
        sessionId: id,
      },
      include: {
        responses: true,
      },
    });

    const responses = (link?.responses ?? []).map((response) => ({
      familyCode: response.familyCode,
      choice: response.choice,
      kidNames: toStringArray(response.kidNames),
      createdAt: response.createdAt,
    }));

    return NextResponse.json(
      { responses },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "GET /api/sessions/[id]/responses failed:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to load responses." },
      { status: 500 },
    );
  }
}