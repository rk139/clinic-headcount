import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeName(x: any) {
  return String(x ?? "").trim();
}

function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map(normalizeName).filter(Boolean);

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(normalizeName).filter(Boolean);
    } catch {}
  }

  return [];
}

export async function GET(req: Request, ctx: any) {
  try {
    // Next 16 sometimes makes params a Promise
    const p = await ctx?.params;
    const id = p?.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid params.id", got: p ?? null },
        { status: 400 }
      );
    }

    const link = await prisma.responseLink.findUnique({
      where: { sessionId: id },
      include: { responses: true },
    });

    const responses = (link?.responses ?? []).map((r: any) => ({
      familyCode: r.familyCode,
      choice: r.choice,
      kidNames: toStringArray(r.kidNames),
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ responses });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message ?? String(e),
        // helpful sometimes:
        name: e?.name,
      },
      { status: 500 }
    );
  }
}