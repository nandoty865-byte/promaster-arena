ALTER TABLE "TournamentRegistration" ADD COLUMN "userId" INTEGER;
ALTER TABLE "TournamentRegistration" ADD COLUMN "playerProfileId" INTEGER;
ALTER TABLE "TournamentRegistration" ADD COLUMN "category" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "modality" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "sportName" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "rulesAcceptedAt" TIMESTAMP(3);
ALTER TABLE "TournamentRegistration" ALTER COLUMN "rg" DROP NOT NULL;

UPDATE "TournamentRegistration" AS tr
SET
  "userId" = pa."userId",
  "playerProfileId" = pa."id"
FROM "PlayerAccount" AS pa
WHERE LOWER(pa."email") = LOWER(tr."email")
  AND tr."playerProfileId" IS NULL;

CREATE INDEX "TournamentRegistration_userId_idx" ON "TournamentRegistration"("userId");
CREATE INDEX "TournamentRegistration_playerProfileId_idx" ON "TournamentRegistration"("playerProfileId");

ALTER TABLE "TournamentRegistration"
ADD CONSTRAINT "TournamentRegistration_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TournamentRegistration"
ADD CONSTRAINT "TournamentRegistration_playerProfileId_fkey"
FOREIGN KEY ("playerProfileId") REFERENCES "PlayerAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
