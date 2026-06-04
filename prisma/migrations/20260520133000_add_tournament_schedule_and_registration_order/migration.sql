ALTER TABLE "Tournament" ADD COLUMN "matchQuantity" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN "matchQuantityMode" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "Tournament" ADD COLUMN "phaseSchedule" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "sortOrder" INTEGER;
