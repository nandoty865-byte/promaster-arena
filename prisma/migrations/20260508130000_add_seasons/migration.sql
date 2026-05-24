CREATE TABLE "Season" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "tournamentCount" INTEGER NOT NULL,
  "playerCount" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "locations" TEXT,
  "rules" TEXT,
  "prize" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "championName" TEXT,
  "championPoints" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Season" ADD CONSTRAINT "Season_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tournament" ADD COLUMN "seasonId" INTEGER;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
