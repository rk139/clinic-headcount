-- CreateEnum
CREATE TYPE "RegistrationMethod" AS ENUM ('PUBLIC_LINK', 'ADMIN', 'WALK_IN_CONVERSION');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceChoice" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('QR', 'SEARCH', 'STAFF', 'WALK_IN');

-- AlterTable
ALTER TABLE "ClinicSession" ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "ClinicSeries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programType" TEXT NOT NULL,
    "level" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "parentEmail" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "birthDate" TEXT,
    "medicalNotes" TEXT,
    "familyCode" TEXT,
    "qrToken" TEXT NOT NULL,
    "registrationMethod" "RegistrationMethod" NOT NULL DEFAULT 'PUBLIC_LINK',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceConfirmation" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "choice" "AttendanceChoice",
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalkIn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "parentEmail" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "medicalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalkIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "registrationId" TEXT,
    "walkInId" TEXT,
    "method" "CheckInMethod" NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicSeries_startDate_endDate_idx" ON "ClinicSeries"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ClinicSeries_programType_level_idx" ON "ClinicSeries"("programType", "level");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationLink_token_key" ON "RegistrationLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationLink_seriesId_key" ON "RegistrationLink"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_qrToken_key" ON "Registration"("qrToken");

-- CreateIndex
CREATE INDEX "Registration_seriesId_idx" ON "Registration"("seriesId");

-- CreateIndex
CREATE INDEX "Registration_childName_idx" ON "Registration"("childName");

-- CreateIndex
CREATE INDEX "Registration_familyCode_idx" ON "Registration"("familyCode");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceConfirmation_token_key" ON "AttendanceConfirmation"("token");

-- CreateIndex
CREATE INDEX "AttendanceConfirmation_sessionId_idx" ON "AttendanceConfirmation"("sessionId");

-- CreateIndex
CREATE INDEX "AttendanceConfirmation_registrationId_idx" ON "AttendanceConfirmation"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceConfirmation_registrationId_sessionId_key" ON "AttendanceConfirmation"("registrationId", "sessionId");

-- CreateIndex
CREATE INDEX "WalkIn_sessionId_idx" ON "WalkIn"("sessionId");

-- CreateIndex
CREATE INDEX "WalkIn_childName_idx" ON "WalkIn"("childName");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_walkInId_key" ON "CheckIn"("walkInId");

-- CreateIndex
CREATE INDEX "CheckIn_sessionId_idx" ON "CheckIn"("sessionId");

-- CreateIndex
CREATE INDEX "CheckIn_registrationId_idx" ON "CheckIn"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_sessionId_registrationId_key" ON "CheckIn"("sessionId", "registrationId");

-- CreateIndex
CREATE INDEX "ClinicSession_seriesId_idx" ON "ClinicSession"("seriesId");

-- AddForeignKey
ALTER TABLE "ClinicSession" ADD CONSTRAINT "ClinicSession_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ClinicSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationLink" ADD CONSTRAINT "RegistrationLink_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ClinicSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ClinicSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceConfirmation" ADD CONSTRAINT "AttendanceConfirmation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceConfirmation" ADD CONSTRAINT "AttendanceConfirmation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalkIn" ADD CONSTRAINT "WalkIn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_walkInId_fkey" FOREIGN KEY ("walkInId") REFERENCES "WalkIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
