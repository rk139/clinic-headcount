-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COACH', 'ADMIN');

-- CreateTable
CREATE TABLE "ClinicSession" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "programType" TEXT NOT NULL,
    "level" INTEGER,
    "capacity" INTEGER NOT NULL,
    "fullSessionCount" INTEGER NOT NULL DEFAULT 0,
    "makeUpCount" INTEGER NOT NULL DEFAULT 0,
    "singleDateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponseLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionResponse" (
    "id" TEXT NOT NULL,
    "familyCode" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "kidNames" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kidName" TEXT NOT NULL,
    "kidKey" TEXT NOT NULL,
    "familyCode" TEXT,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicSession_date_idx" ON "ClinicSession"("date");

-- CreateIndex
CREATE INDEX "ClinicSession_programType_level_idx" ON "ClinicSession"("programType", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseLink_token_key" ON "ResponseLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseLink_sessionId_key" ON "ResponseLink"("sessionId");

-- CreateIndex
CREATE INDEX "SessionResponse_linkId_idx" ON "SessionResponse"("linkId");

-- CreateIndex
CREATE INDEX "SessionResponse_createdAt_idx" ON "SessionResponse"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionResponse_linkId_familyCode_key" ON "SessionResponse"("linkId", "familyCode");

-- CreateIndex
CREATE INDEX "SessionAttendance_sessionId_idx" ON "SessionAttendance"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_sessionId_kidKey_key" ON "SessionAttendance"("sessionId", "kidKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "ResponseLink" ADD CONSTRAINT "ResponseLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionResponse" ADD CONSTRAINT "SessionResponse_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ResponseLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
