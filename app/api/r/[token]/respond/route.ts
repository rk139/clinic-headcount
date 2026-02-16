import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function sessionStartMs(date: string, startTime: string) {
  const d = new Date(`${date}T${startTime}:00`);
  return d.getTime();
}

type Choice = "attending" | "not_attending";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = (await req.json().catch(() => null)) as
      | { choice?: Choice; kidNames?: unknown }
      | null;

    const choice = body?.choice;
    if (choice !== "attending" && choice !== "not_attending") {
      return NextResponse.json(
        { ok: false, error: "Invalid choice" },
        { status: 400 }
      );
    }

    // NEW: one RSVP submission can include 1+ kid names
    // Example incoming: ["Ayaan", "Anika"]
    const rawKidNames = body?.kidNames;

    const kidNames = Array.isArray(rawKidNames)
      ? rawKidNames
          .filter((n): n is string => typeof n === "string")
          .map((n) => n.trim())
          .filter((n) => n.length > 0)
          .slice(0, 6) // small cap to prevent abuse; adjust if you want
      : [];

    const link = await prisma.responseLink.findUnique({
      where: { token },
      include: {
        session: true,
        responses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!link) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Optional expiresAt support
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "This link has expired" },
        { status: 410 }
      );
    }

    // ✅ Step 6: manual close support
    if (link.closedAt) {
      return NextResponse.json(
        { ok: false, error: "This link is closed." },
        { status: 410 }
      );
    }

    // Close at clinic start time
    const start = sessionStartMs(link.session.date, link.session.startTime);
    if (!Number.isNaN(start) && Date.now() >= start) {
      return NextResponse.json(
        { ok: false, error: "This link is closed (clinic has started)." },
        { status: 410 }
      );
    }

    const previousChoice = link.responses[0]?.choice ?? null;
    const replaced = previousChoice !== null;

    // ✅ Latest response wins (atomic)
    const created = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.sessionResponse.deleteMany({
          where: { linkId: link.id },
        });

        return tx.sessionResponse.create({
          data: {
            linkId: link.id,
            choice, // Prisma field is "choice"
            kidNames: kidNames.length ? kidNames : null,
          },
        });
      }
    );

    return NextResponse.json({
      ok: true,
      id: created.id,
      choice: created.choice,
      kidNames: created.kidNames,
      replaced,
      previousChoice,
    });
  } catch (err) {
    console.error("POST /api/r/[token]/respond failed:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}






