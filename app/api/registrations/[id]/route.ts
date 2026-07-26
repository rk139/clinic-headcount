import {
    RegistrationStatus,
    type Prisma,
  } from "@prisma/client";
  import { NextResponse } from "next/server";
  
  import { getCurrentSession } from "@/lib/auth";
  import { prisma } from "@/lib/prisma";
  
  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";
  
  type RouteContext = {
    params: Promise<{
      id: string;
    }>;
  };
  
  type UpdateRegistrationBody = {
    childName?: unknown;
    parentName?: unknown;
    parentPhone?: unknown;
    parentEmail?: unknown;
    emergencyContactName?: unknown;
    emergencyContactPhone?: unknown;
    birthDate?: unknown;
    medicalNotes?: unknown;
    familyCode?: unknown;
    status?: unknown;
  };
  
  function requiredString(
    value: unknown,
    fieldName: string,
  ): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${fieldName} is required.`);
    }
  
    return value.trim();
  }
  
  function optionalString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
  
    const trimmedValue = value.trim();
  
    return trimmedValue || null;
  }
  
  function isRegistrationStatus(
    value: unknown,
  ): value is RegistrationStatus {
    return (
      value === RegistrationStatus.ACTIVE ||
      value === RegistrationStatus.CANCELLED
    );
  }
  
  async function requireAdmin() {
    const session = await getCurrentSession();
  
    if (!session) {
      return {
        error: NextResponse.json(
          {
            ok: false,
            error: "Unauthorized.",
          },
          {
            status: 401,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        ),
      };
    }
  
    if (session.role !== "ADMIN") {
      return {
        error: NextResponse.json(
          {
            ok: false,
            error: "Admin access is required.",
          },
          {
            status: 403,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        ),
      };
    }
  
    return {
      session,
    };
  }
  
  export async function PATCH(
    request: Request,
    context: RouteContext,
  ) {
    try {
      const authorization = await requireAdmin();
  
      if ("error" in authorization) {
        return authorization.error;
      }
  
      const { id } = await context.params;
  
      if (!id?.trim()) {
        return NextResponse.json(
          {
            ok: false,
            error: "Registration ID is required.",
          },
          {
            status: 400,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }
  
      const existingRegistration =
        await prisma.registration.findUnique({
          where: {
            id,
          },
          select: {
            id: true,
          },
        });
  
      if (!existingRegistration) {
        return NextResponse.json(
          {
            ok: false,
            error: "Registration not found.",
          },
          {
            status: 404,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }
  
      const body =
        (await request.json()) as UpdateRegistrationBody;
  
      const data: Prisma.RegistrationUpdateInput = {};
  
      if (body.childName !== undefined) {
        data.childName = requiredString(
          body.childName,
          "Child name",
        );
      }
  
      if (body.parentName !== undefined) {
        data.parentName = requiredString(
          body.parentName,
          "Parent name",
        );
      }
  
      if (body.parentPhone !== undefined) {
        data.parentPhone = requiredString(
          body.parentPhone,
          "Parent phone",
        );
      }
  
      if (body.parentEmail !== undefined) {
        data.parentEmail = optionalString(body.parentEmail);
      }
  
      if (body.emergencyContactName !== undefined) {
        data.emergencyContactName = optionalString(
          body.emergencyContactName,
        );
      }
  
      if (body.emergencyContactPhone !== undefined) {
        data.emergencyContactPhone = optionalString(
          body.emergencyContactPhone,
        );
      }
  
      if (body.birthDate !== undefined) {
        data.birthDate = optionalString(body.birthDate);
      }
  
      if (body.medicalNotes !== undefined) {
        data.medicalNotes = optionalString(
          body.medicalNotes,
        );
      }
  
      if (body.familyCode !== undefined) {
        data.familyCode = optionalString(body.familyCode);
      }
  
      if (body.status !== undefined) {
        if (!isRegistrationStatus(body.status)) {
          return NextResponse.json(
            {
              ok: false,
              error: "Invalid registration status.",
            },
            {
              status: 400,
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        }
  
        data.status = body.status;
      }
  
      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "No registration changes were provided.",
          },
          {
            status: 400,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }
  
      const registration =
        await prisma.registration.update({
          where: {
            id,
          },
          data,
          select: {
            id: true,
            childName: true,
  
            parentName: true,
            parentPhone: true,
            parentEmail: true,
  
            emergencyContactName: true,
            emergencyContactPhone: true,
  
            birthDate: true,
            medicalNotes: true,
            familyCode: true,
  
            qrToken: true,
            registrationMethod: true,
            status: true,
  
            createdAt: true,
            updatedAt: true,
  
            series: {
              select: {
                id: true,
                name: true,
                programType: true,
                level: true,
                startDate: true,
                endDate: true,
              },
            },
  
            _count: {
              select: {
                attendanceConfirmations: true,
                checkIns: true,
              },
            },
          },
        });
  
      return NextResponse.json(
        {
          ok: true,
          registration: {
            ...registration,
            createdAt:
              registration.createdAt.toISOString(),
            updatedAt:
              registration.updatedAt.toISOString(),
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    } catch (error) {
      console.error(
        "PATCH /api/registrations/[id] failed:",
        error,
      );
  
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update registration.";
  
      const isValidationError =
        error instanceof Error &&
        error.message.endsWith("is required.");
  
      return NextResponse.json(
        {
          ok: false,
          error: message,
        },
        {
          status: isValidationError ? 400 : 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }