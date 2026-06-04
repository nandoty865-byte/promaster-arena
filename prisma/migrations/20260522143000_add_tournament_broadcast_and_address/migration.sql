ALTER TABLE "Tournament" ADD COLUMN "venueAddress" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "broadcastType" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Tournament" ADD COLUMN "obsStreamUrl" TEXT;
