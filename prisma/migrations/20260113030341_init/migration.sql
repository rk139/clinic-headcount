-- CreateTable
CREATE TABLE "ClinicSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "coachName" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "expected" INTEGER NOT NULL,
    "checkedIn" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
