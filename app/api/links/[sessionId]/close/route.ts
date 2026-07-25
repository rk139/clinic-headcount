import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

async function requireAdmin() {
  const currentSession = await getCurrentSession();

  if (!currentSession) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  if (currentSession.role !== "ADMIN") {
    return NextResponse.json(
      {
        ok: false,
        error: "Administrator access required.",
      },
      { status: 403 },
    );
  }

  return null;
}

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const authError = await requireAdmin();

    if (authError) {
      return authError;
    }

    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid session ID.",
        },
        { status: 400 },
      );
    }

    const link = await prisma.responseLink.findUnique({
      where: {
        sessionId,
      },
      select: {
        sessionId: true,
      },
    });

    if (!link) {
      return NextResponse.json(
        {
          ok: false,
          error: "Response link not found.",
        },
        { status: 404 },
      );
    }

    await prisma.responseLink.update({
      where: {
        sessionId,
      },
      data: {
        closedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "POST /api/links/[sessionId]/close failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to close response link.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const authError = await requireAdmin();

    if (authError) {
      return authError;
    }

    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid session ID.",
        },
        { status: 400 },
      );
    }

    const link = await prisma.responseLink.findUnique({
      where: {
        sessionId,
      },
      select: {
        sessionId: true,
      },
    });

    if (!link) {
      return NextResponse.json(
        {
          ok: false,
          error: "Response link not found.",
        },
        { status: 404 },
      );
    }

    await prisma.responseLink.update({
      where: {
        sessionId,
      },
      data: {
        closedAt: null,
      },
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/links/[sessionId]/close failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to reopen response link.",
      },
      { status: 500 },
    );
  }
}
