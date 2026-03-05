import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: any) {
  try {
    const p = await ctx?.params;
    const id = p?.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid params.id", got: p ?? null },
        { status: 400 }
      );
    }

    const rows = await prisma.sessionAttendance.findMany({
      where: { sessionId: id },
      orderBy: { kidName: "asc" },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e), name: e?.name },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, ctx: any) {
  try {
    const p = await ctx?.params;
    const id = p?.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid params.id", got: p ?? null },
        { status: 400 }
      );
    }

    const body = await req.json();
    const attendance = body.attendance ?? {};

    const updates = Object.entries(attendance).map(([kidKey, row]: any) =>
      prisma.sessionAttendance.upsert({
        where: {
          sessionId_kidKey: {
            sessionId: id,
            kidKey,
          },
        },
        update: {
          attended: Boolean(row.attended),
          kidName: String(row.kidName ?? ""),
          familyCode: row.familyCode ? String(row.familyCode) : null,
        },
        create: {
          sessionId: id,
          kidKey,
          kidName: String(row.kidName ?? ""),
          familyCode: row.familyCode ? String(row.familyCode) : null,
          attended: Boolean(row.attended),
        },
      })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e), name: e?.name },
      { status: 500 }
    );
  }
}