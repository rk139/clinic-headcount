import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const body = await req.json();

  const fullSessionCount = Number(body.fullSessionCount);
  const makeUpCount = Number(body.makeUpCount);
  const singleDateCount = Number(body.singleDateCount);

  const updated = await prisma.clinicSession.update({
    where: { id },
    data: {
      fullSessionCount,
      makeUpCount,
      singleDateCount,
    },
  });

  return NextResponse.json(updated);
}

