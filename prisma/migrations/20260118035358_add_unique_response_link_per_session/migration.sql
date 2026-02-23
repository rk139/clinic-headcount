/*
  Warnings:

  - A unique constraint covering the columns `[sessionId]` on the table `ResponseLink` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "ClinicSession_date_idx" ON "ClinicSession"("date");

-- CreateIndex
CREATE INDEX "ClinicSession_programType_level_idx" ON "ClinicSession"("programType", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseLink_sessionId_key" ON "ResponseLink"("sessionId");

-- CreateIndex
CREATE INDEX "SessionResponse_linkId_idx" ON "SessionResponse"("linkId");

-- CreateIndex
CREATE INDEX "SessionResponse_createdAt_idx" ON "SessionResponse"("createdAt");
