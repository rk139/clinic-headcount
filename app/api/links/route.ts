import crypto from "crypto";
import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function makeToken() {
  return crypto.randomBytes(16).toString("hex");
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const sessionId =
      typeof body.sessionId === "string"
        ? body.sessionId.trim()
        : "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 },
      );
    }

    const session = await prisma.clinicSession.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    const existing = await prisma.responseLink.findFirst({
      where: {
        sessionId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        token: true,
      },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const created = await prisma.responseLink.create({
      data: {
        sessionId,
        token: makeToken(),
      },
      select: {
        token: true,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("POST /api/links failed:", error);

    return NextResponse.json(
      { error: "Failed to create response link." },
      { status: 500 },
    );
  }
}

