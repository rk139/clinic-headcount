import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function makeToken() {
  return crypto.randomBytes(16).toString("hex");
}

type Template = {
  weekday: number; // 0=Sun ... 6=Sat
  startTime: string;
  endTime: string;
  programType: string;
  level: string | null;
  capacity: number;
};

type ExistingKeyRow = {
  date: string;
  startTime: string;
  endTime: string;
  programType: string;
  level: string | null;
  capacity: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          weeksAhead?: number;
          lookbackWeeks?: number;
          createLinks?: boolean;
        }
      | null;

    const weeksAhead = Math.max(1, Math.min(12, body?.weeksAhead ?? 4));
    const lookbackWeeks = Math.max(1, Math.min(12, body?.lookbackWeeks ?? 6));
    const createLinks = body?.createLinks ?? true;

    const today = startOfToday();

    const lookbackStart = addDays(today, -lookbackWeeks * 7);
    const lookaheadEnd = addDays(today, weeksAhead * 7);

    // 1) use recent sessions as templates
    const recent = await prisma.clinicSession.findMany({
      where: {
        date: {
          gte: toYMD(lookbackStart),
          lt: toYMD(today),
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const templatesMap = new Map<string, Template>();

    for (const s of recent) {
      const wd = new Date(`${s.date}T00:00:00`).getDay();

      const t: Template = {
        weekday: wd,
        startTime: s.startTime,
        endTime: s.endTime,
        programType: s.programType,
        level: s.level,
        capacity: s.capacity,
      };

      const key = [
        t.weekday,
        t.startTime,
        t.endTime,
        t.programType,
        t.level ?? "null",
        t.capacity,
      ].join("|");

      templatesMap.set(key, t);
    }

    const templates = Array.from(templatesMap.values());

    if (!templates.length) {
      return NextResponse.json(
        { ok: false, error: "No recent sessions found to use as templates." },
        { status: 400 }
      );
    }

    // 2) preload future sessions so we can skip duplicates
    const existingFuture = (await prisma.clinicSession.findMany({
      where: {
        date: {
          gte: toYMD(today),
          lt: toYMD(lookaheadEnd),
        },
      },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        programType: true,
        level: true,
        capacity: true,
      },
    })) as ExistingKeyRow[];

    const keyOf = (x: ExistingKeyRow) =>
      [
        x.date,
        x.startTime,
        x.endTime,
        x.programType,
        x.level ?? "null",
        x.capacity,
      ].join("|");

    const existingSet = new Set(existingFuture.map((row: ExistingKeyRow) => keyOf(row)));

    const toCreate: Array<{
      date: string;
      startTime: string;
      endTime: string;
      programType: string;
      level: string | null;
      capacity: number;
    }> = [];

    let skippedSessions = 0;

    // 3) generate
    for (let d = new Date(today); d < lookaheadEnd; d = addDays(d, 1)) {
      const weekday = d.getDay();
      const dateStr = toYMD(d);

      for (const t of templates) {
        if (t.weekday !== weekday) continue;

        const candidate: ExistingKeyRow = {
          date: dateStr,
          startTime: t.startTime,
          endTime: t.endTime,
          programType: t.programType,
          level: t.level,
          capacity: t.capacity,
        };

        const k = keyOf(candidate);

        if (existingSet.has(k)) {
          skippedSessions += 1;
          continue;
        }

        toCreate.push({
          date: dateStr,
          startTime: t.startTime,
          endTime: t.endTime,
          programType: t.programType,
          level: t.level,
          capacity: t.capacity,
        });

        existingSet.add(k);
      }
    }

    // 4) create sessions
    const createdSessions = await prisma.$transaction(
      toCreate.map((data) => prisma.clinicSession.create({ data }))
    );

    // 5) create response links
    let createdLinks = 0;
    if (createLinks && createdSessions.length) {
      await prisma.$transaction(
        createdSessions.map((s: any) =>
          prisma.responseLink.create({
            data: {
              token: makeToken(),
              sessionId: s.id,
            },
          })
        )
      );
      createdLinks = createdSessions.length;
    }

    return NextResponse.json({
      ok: true,
      templatesUsed: templates.length,
      range: { from: toYMD(today), toExclusive: toYMD(lookaheadEnd) },
      createdSessions: createdSessions.length,
      skippedSessions,
      createdLinks,
    });
  } catch (err: any) {
    console.error("POST /api/admin/seed-sessions failed:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}