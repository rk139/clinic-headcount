import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function makeToken() {
  return crypto.randomBytes(16).toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId ?? "");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Ensure session exists
    const session = await prisma.clinicSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // ✅ Reuse existing (works whether sessionId is unique or not)
    const existing = await prisma.responseLink.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      select: { token: true },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    // Create new link
    const created = await prisma.responseLink.create({
      data: {
        sessionId,
        token: makeToken(),
      },
      select: { token: true },
    });

    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }
}

