import crypto from "crypto";
import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  startDate?: string;
  endDate?: string;
  weekdays?: number[];
  startTime?: string;
  endTime?: string;
  programType?: string;
  level?: string | null;
  capacity?: number;
  createLinks?: boolean;
};

type SessionKeyData = {
  date: string;
  startTime: string;
  endTime: string;
  programType: string;
  level: string | null;
};

function makeToken() {
  return crypto.randomBytes(16).toString("hex");
}

function toYMD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseYMD(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  return date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);

  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);

  return result;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function sessionKey(session: SessionKeyData) {
  return [
    session.date,
    session.startTime,
    session.endTime,
    session.programType,
    session.level ?? "null",
  ].join("|");
}

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

    const body = (await request.json().catch(() => null)) as
      | RequestBody
      | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid request body is required.",
        },
        { status: 400 },
      );
    }

    if (
      typeof body.startDate !== "string" ||
      typeof body.endDate !== "string"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Start date and end date are required.",
        },
        { status: 400 },
      );
    }

    const startDate = parseYMD(body.startDate);
    const endDate = parseYMD(body.endDate);

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dates must use the YYYY-MM-DD format.",
        },
        { status: 400 },
      );
    }

    if (endDate < startDate) {
      return NextResponse.json(
        {
          ok: false,
          error: "The end date cannot be before the start date.",
        },
        { status: 400 },
      );
    }

    const maximumEndDate = addDays(startDate, 180);

    if (endDate > maximumEndDate) {
      return NextResponse.json(
        {
          ok: false,
          error: "The date range cannot be longer than 180 days.",
        },
        { status: 400 },
      );
    }

    const weekdays = Array.from(
      new Set(
        Array.isArray(body.weekdays)
          ? body.weekdays.filter(
              (day) =>
                Number.isInteger(day) &&
                day >= 0 &&
                day <= 6,
            )
          : [],
      ),
    );

    if (weekdays.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Select at least one day of the week.",
        },
        { status: 400 },
      );
    }

    if (
      typeof body.startTime !== "string" ||
      typeof body.endTime !== "string" ||
      !isValidTime(body.startTime) ||
      !isValidTime(body.endTime)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Valid start and end times are required.",
        },
        { status: 400 },
      );
    }

    if (body.endTime <= body.startTime) {
      return NextResponse.json(
        {
          ok: false,
          error: "The end time must be after the start time.",
        },
        { status: 400 },
      );
    }

    if (
      body.programType !== "JUNIORS" &&
      body.programType !== "RED_BALL"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "The program type is invalid.",
        },
        { status: 400 },
      );
    }

    const level =
      body.programType === "RED_BALL"
        ? null
        : typeof body.level === "string"
          ? body.level.trim()
          : "";

    if (body.programType === "JUNIORS" && !level) {
      return NextResponse.json(
        {
          ok: false,
          error: "A level is required for junior clinics.",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(body.capacity) ||
      body.capacity === undefined ||
      body.capacity < 1 ||
      body.capacity > 100
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Capacity must be between 1 and 100.",
        },
        { status: 400 },
      );
    }

    const createLinks =
      typeof body.createLinks === "boolean"
        ? body.createLinks
        : true;

    const existingSessions = await prisma.clinicSession.findMany({
      where: {
        date: {
          gte: toYMD(startDate),
          lte: toYMD(endDate),
        },
      },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        programType: true,
        level: true,
      },
    });

    const existingKeys = new Set(
      existingSessions.map((session) =>
        sessionKey(session),
      ),
    );

    const sessionsToCreate: Array<{
      date: string;
      startTime: string;
      endTime: string;
      programType: string;
      level: string | null;
      capacity: number;
    }> = [];

    let skippedSessions = 0;

    for (
      let date = new Date(startDate);
      date <= endDate;
      date = addDays(date, 1)
    ) {
      if (!weekdays.includes(date.getDay())) {
        continue;
      }

      const candidate = {
        date: toYMD(date),
        startTime: body.startTime,
        endTime: body.endTime,
        programType: body.programType,
        level,
        capacity: body.capacity,
      };

      const key = sessionKey(candidate);

      if (existingKeys.has(key)) {
        skippedSessions += 1;
        continue;
      }

      sessionsToCreate.push(candidate);
      existingKeys.add(key);
    }

    const createdSessions =
      sessionsToCreate.length > 0
        ? await prisma.$transaction(
            sessionsToCreate.map((session) =>
              prisma.clinicSession.create({
                data: session,
              }),
            ),
          )
        : [];

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
      range: {
        from: toYMD(startDate),
        through: toYMD(endDate),
      },
      createdSessions: createdSessions.length,
      skippedSessions,
      createdLinks,
    });
  } catch (error) {
    console.error(
      "POST /api/admin/seed-sessions failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate sessions.",
      },
      { status: 500 },
    );
  }
}