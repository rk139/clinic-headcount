import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type ChildInput = {
  childName?: unknown;
  birthDate?: unknown;
  medicalNotes?: unknown;
};

type RegistrationRequestBody = {
  parentName?: unknown;
  parentPhone?: unknown;
  parentEmail?: unknown;
  emergencyContactName?: unknown;
  emergencyContactPhone?: unknown;
  familyCode?: unknown;
  children?: unknown;
};

function cleanRequiredString(
  value: unknown,
  maximumLength: number,
) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function cleanOptionalString(
  value: unknown,
  maximumLength: number,
) {
  if (typeof value !== "string") {
    return null;
  }

  const cleanedValue = value.trim().slice(0, maximumLength);

  return cleanedValue.length > 0 ? cleanedValue : null;
}

function normalizeEmail(value: unknown) {
  const email = cleanOptionalString(value, 254);

  return email ? email.toLowerCase() : null;
}

function normalizeFamilyCode(value: unknown) {
  const familyCode = cleanOptionalString(value, 50);

  return familyCode ? familyCode.toUpperCase() : null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidBirthDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeChildren(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 6)
    .map((child): ChildInput =>
      typeof child === "object" && child !== null
        ? (child as ChildInput)
        : {},
    )
    .map((child) => ({
      childName: cleanRequiredString(child.childName, 120),
      birthDate: cleanOptionalString(child.birthDate, 10),
      medicalNotes: cleanOptionalString(
        child.medicalNotes,
        1_000,
      ),
    }))
    .filter((child) => child.childName.length > 0);
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { token } = await context.params;
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid registration link.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    let body: RegistrationRequestBody;

    try {
      body = (await request.json()) as RegistrationRequestBody;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid registration information.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const parentName = cleanRequiredString(
      body.parentName,
      120,
    );

    const parentPhone = cleanRequiredString(
      body.parentPhone,
      50,
    );

    const parentEmail = normalizeEmail(body.parentEmail);

    const emergencyContactName = cleanOptionalString(
      body.emergencyContactName,
      120,
    );

    const emergencyContactPhone = cleanOptionalString(
      body.emergencyContactPhone,
      50,
    );

    const familyCode = normalizeFamilyCode(body.familyCode);
    const children = normalizeChildren(body.children);

    if (!parentName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Parent or guardian name is required.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!parentPhone) {
      return NextResponse.json(
        {
          ok: false,
          error: "Parent or guardian phone number is required.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (parentEmail && !isValidEmail(parentEmail)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a valid email address.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (children.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter at least one child.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const invalidBirthDate = children.some(
      (child) =>
        child.birthDate &&
        !isValidBirthDate(child.birthDate),
    );

    if (invalidBirthDate) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a valid birth date.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const link = await prisma.registrationLink.findUnique({
      where: {
        token: trimmedToken,
      },
      include: {
        series: {
          include: {
            sessions: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!link) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid registration link.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (link.closedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "This registration link is closed.",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (
      link.expiresAt &&
      link.expiresAt.getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "This registration link has expired.",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!link.series.registrationOpen) {
      return NextResponse.json(
        {
          ok: false,
          error: "Registration for this clinic series is closed.",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const createdRegistrations = await prisma.$transaction(
      children.map((child) =>
        prisma.registration.create({
          data: {
            seriesId: link.series.id,
            childName: child.childName,
            parentName,
            parentPhone,
            parentEmail,
            emergencyContactName,
            emergencyContactPhone,
            birthDate: child.birthDate,
            medicalNotes: child.medicalNotes,
            familyCode,
            registrationMethod: "PUBLIC_LINK",
            status: "ACTIVE",

            attendanceConfirmations: {
              create: link.series.sessions.map((session) => ({
                sessionId: session.id,
              })),
            },
          },
          select: {
            id: true,
            childName: true,
            qrToken: true,
          },
        }),
      ),
    );

    return NextResponse.json(
      {
        ok: true,
        message:
          createdRegistrations.length === 1
            ? `${createdRegistrations[0].childName} has been registered successfully.`
            : `${createdRegistrations.length} children have been registered successfully.`,
        registrations: createdRegistrations,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "POST /api/r/[token]/register failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Registration could not be completed. Please try again.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}