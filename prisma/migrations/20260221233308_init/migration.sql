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
CREATE INDEX "SessionResponse_linkId_familyCode_idx" ON "SessionResponse"("linkId", "familyCode");

-- AddForeignKey
ALTER TABLE "ResponseLink" ADD CONSTRAINT "ResponseLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionResponse" ADD CONSTRAINT "SessionResponse_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ResponseLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
