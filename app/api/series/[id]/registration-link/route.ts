import crypto from "crypto";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function requireAdmin() {
  const currentUser = await getCurrentSession();

  if (!currentUser) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  if (currentUser.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      ),
    };
  }

  return {
    currentUser,
  };
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { id } = await context.params;

    const existingSeries = await prisma.clinicSeries.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        registrationLink: {
          select: {
            id: true,
            token: true,
            closedAt: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!existingSeries) {
      return NextResponse.json(
        { error: "Clinic series not found" },
        { status: 404 },
      );
    }

    if (existingSeries.registrationLink) {
      const updatedLink = await prisma.registrationLink.update({
        where: {
          id: existingSeries.registrationLink.id,
        },
        data: {
          closedAt: null,
        },
        select: {
          token: true,
          closedAt: true,
          expiresAt: true,
        },
      });

      return NextResponse.json(updatedLink);
    }

    const registrationLink =
      await prisma.registrationLink.create({
        data: {
          token: generateToken(),
          seriesId: existingSeries.id,
        },
        select: {
          token: true,
          closedAt: true,
          expiresAt: true,
        },
      });

    return NextResponse.json(
      registrationLink,
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Failed to generate registration link:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to generate registration link" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { id } = await context.params;

    const existingLink =
      await prisma.registrationLink.findUnique({
        where: {
          seriesId: id,
        },
        select: {
          id: true,
        },
      });

    if (!existingLink) {
      return NextResponse.json(
        { error: "Registration link not found" },
        { status: 404 },
      );
    }

    const closedLink =
      await prisma.registrationLink.update({
        where: {
          id: existingLink.id,
        },
        data: {
          closedAt: new Date(),
        },
        select: {
          token: true,
          closedAt: true,
          expiresAt: true,
        },
      });

    return NextResponse.json(closedLink);
  } catch (error) {
    console.error(
      "Failed to close registration link:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to close registration link" },
      { status: 500 },
    );
  }
}