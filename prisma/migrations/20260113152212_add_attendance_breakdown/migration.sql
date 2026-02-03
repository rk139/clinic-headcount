/*
  Warnings:

  - You are about to drop the column `checkedIn` on the `ClinicSession` table. All the data in the column will be lost.
  - You are about to drop the column `coachName` on the `ClinicSession` table. All the data in the column will be lost.
  - You are about to drop the column `expected` on the `ClinicSession` table. All the data in the column will be lost.
  - You are about to drop the column `programName` on the `ClinicSession` table. All the data in the column will be lost.
  - Added the required column `programType` to the `ClinicSession` table without a default value. This is not possible if the table is not empty.

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
    "label" TEXT,
    "capacity" INTEGER NOT NULL,
    "fullSessionCount" INTEGER NOT NULL DEFAULT 0,
    "walkInCount" INTEGER NOT NULL DEFAULT 0,
    "makeUpCount" INTEGER NOT NULL DEFAULT 0,
    "checkedInCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ClinicSession" ("capacity", "createdAt", "date", "endTime", "id", "startTime", "updatedAt") SELECT "capacity", "createdAt", "date", "endTime", "id", "startTime", "updatedAt" FROM "ClinicSession";
DROP TABLE "ClinicSession";
ALTER TABLE "new_ClinicSession" RENAME TO "ClinicSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
