import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const currentSession = await getCurrentSession();

    if (!currentSession) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (currentSession.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const fullSessionCount = Number(body.fullSessionCount);
    const makeUpCount = Number(body.makeUpCount);
    const singleDateCount = Number(body.singleDateCount);

    if (
      !Number.isFinite(fullSessionCount) ||
      !Number.isFinite(makeUpCount) ||
      !Number.isFinite(singleDateCount)
    ) {
      return NextResponse.json(
        { error: "All attendance counts must be valid numbers." },
        { status: 400 },
      );
    }

    const updated = await prisma.clinicSession.update({
      where: {
        id,
      },
      data: {
        fullSessionCount,
        makeUpCount,
        singleDateCount,
      },
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

