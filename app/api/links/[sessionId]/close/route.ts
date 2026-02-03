import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    await prisma.responseLink.update({
      where: { sessionId },
      data: { closedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/links/[sessionId]/close failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to close link" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    await prisma.responseLink.update({
      where: { sessionId },
      data: { closedAt: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/links/[sessionId]/close failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to reopen link" },
      { status: 500 }
    );
  }
}
