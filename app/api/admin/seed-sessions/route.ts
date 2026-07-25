import crypto from "crypto";
import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toYMD(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);

  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);

  return result;
}

function startOfToday() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date;
}

function makeToken() {
  return crypto.randomBytes(16).toString("hex");
}

type Template = {
  weekday: number;
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

type RequestBody = {
  weeksAhead?: number;
  lookbackWeeks?: number;
  createLinks?: boolean;
};

export async function POST(request: Request) {
  try {
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

    const body = (await request.json().catch(() => null)) as RequestBody | null;

    const weeksAhead = Math.max(
      1,
      Math.min(
        12,
        typeof body?.weeksAhead === "number" ? body.weeksAhead : 4,
      ),
    );

    const lookbackWeeks = Math.max(
      1,
      Math.min(
        12,
        typeof body?.lookbackWeeks === "number" ? body.lookbackWeeks : 6,
      ),
    );

    const createLinks =
      typeof body?.createLinks === "boolean" ? body.createLinks : true;

    const today = startOfToday();
    const lookbackStart = addDays(today, -lookbackWeeks * 7);
    const lookaheadEnd = addDays(today, weeksAhead * 7);

    const recentSessions = await prisma.clinicSession.findMany({
      where: {
        date: {
          gte: toYMD(lookbackStart),
          lt: toYMD(today),
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const templatesMap = new Map<string, Template>();

    for (const session of recentSessions) {
      const weekday = new Date(`${session.date}T00:00:00`).getDay();

      const template: Template = {
        weekday,
        startTime: session.startTime,
        endTime: session.endTime,
        programType: session.programType,
        level: session.level,
        capacity: session.capacity,
      };

      const key = [
        template.weekday,
        template.startTime,
        template.endTime,
        template.programType,
        template.level ?? "null",
        template.capacity,
      ].join("|");

      templatesMap.set(key, template);
    }

    const templates = Array.from(templatesMap.values());

    if (templates.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No recent sessions found to use as templates.",
        },
        { status: 400 },
      );
    }

    const existingFutureSessions: ExistingKeyRow[] =
      await prisma.clinicSession.findMany({
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
      });

    function keyOf(session: ExistingKeyRow) {
      return [
        session.date,
        session.startTime,
        session.endTime,
        session.programType,
        session.level ?? "null",
        session.capacity,
      ].join("|");
    }

    const existingSet = new Set(
      existingFutureSessions.map((session) => keyOf(session)),
    );

    const sessionsToCreate: ExistingKeyRow[] = [];
    let skippedSessions = 0;

    for (
      let date = new Date(today);
      date < lookaheadEnd;
      date = addDays(date, 1)
    ) {
      const weekday = date.getDay();
      const dateString = toYMD(date);

      for (const template of templates) {
        if (template.weekday !== weekday) {
          continue;
        }

        const candidate: ExistingKeyRow = {
          date: dateString,
          startTime: template.startTime,
          endTime: template.endTime,
          programType: template.programType,
          level: template.level,
          capacity: template.capacity,
        };

        const key = keyOf(candidate);

        if (existingSet.has(key)) {
          skippedSessions += 1;
          continue;
        }

        sessionsToCreate.push(candidate);
        existingSet.add(key);
      }
    }

    const createdSessions = await prisma.$transaction(
      sessionsToCreate.map((data) =>
        prisma.clinicSession.create({
          data,
        }),
      ),
    );

    let createdLinks = 0;

    if (createLinks && createdSessions.length > 0) {
      await prisma.$transaction(
        createdSessions.map((session) =>
          prisma.responseLink.create({
            data: {
              token: makeToken(),
              sessionId: session.id,
            },
          }),
        ),
      );

      createdLinks = createdSessions.length;
    }

    return NextResponse.json({
      ok: true,
      templatesUsed: templates.length,
      range: {
        from: toYMD(today),
        toExclusive: toYMD(lookaheadEnd),
      },
      createdSessions: createdSessions.length,
      skippedSessions,
      createdLinks,
    });
  } catch (error) {
    console.error("POST /api/admin/seed-sessions failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to seed sessions.",
      },
      { status: 500 },
    );
  }
}