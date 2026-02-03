-- CreateTable
CREATE TABLE "ResponseLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResponseLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionResponse_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ResponseLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseLink_token_key" ON "ResponseLink"("token");
