ALTER TABLE "TournamentRegistration" ADD COLUMN "confirmationToken" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "confirmedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "TournamentRegistration_confirmationToken_key" ON "TournamentRegistration"("confirmationToken");
