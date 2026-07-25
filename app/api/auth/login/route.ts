import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("username" in body) ||
    !("password" in body) ||
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  const username = body.username.trim();
  const password = body.password;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 },
    );
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 },
    );
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: "This account is inactive." },
      { status: 403 },
    );
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });

  response.cookies.set({
    name: "session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

