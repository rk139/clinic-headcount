/*
  Warnings:

  - You are about to drop the column `checkedInCount` on the `ClinicSession` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `ClinicSession` table. All the data in the column will be lost.
  - You are about to drop the column `walkInCount` on the `ClinicSession` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClinicSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "programType" TEXT NOT NULL,
    "level" INTEGER,
    "capacity" INTEGER NOT NULL,
    "fullSessionCount" INTEGER NOT NULL DEFAULT 0,
    "makeUpCount" INTEGER NOT NULL DEFAULT 0,
    "singleDateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ClinicSession" ("capacity", "createdAt", "date", "endTime", "fullSessionCount", "id", "level", "makeUpCount", "programType", "startTime", "updatedAt") SELECT "capacity", "createdAt", "date", "endTime", "fullSessionCount", "id", "level", "makeUpCount", "programType", "startTime", "updatedAt" FROM "ClinicSession";
DROP TABLE "ClinicSession";
ALTER TABLE "new_ClinicSession" RENAME TO "ClinicSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
