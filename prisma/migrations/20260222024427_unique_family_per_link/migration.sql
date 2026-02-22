/*
  Warnings:

  - A unique constraint covering the columns `[linkId,familyCode]` on the table `SessionResponse` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "SessionResponse_linkId_familyCode_idx";

-- CreateIndex
CREATE UNIQUE INDEX "SessionResponse_linkId_familyCode_key" ON "SessionResponse"("linkId", "familyCode");
