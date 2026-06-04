ALTER TABLE "Tournament" ADD COLUMN "bingoCurrentRound" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Tournament" ADD COLUMN "bingoRoundPrize" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "bingoRoundStatus" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "Tournament" ADD COLUMN "bingoLastClaimAt" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN "bingoLastClaimName" TEXT;
