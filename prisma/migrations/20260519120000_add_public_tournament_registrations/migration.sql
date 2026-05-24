ALTER TABLE "Tournament" ADD COLUMN "registrationOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tournament" ADD COLUMN "registrationFee" DOUBLE PRECISION;
ALTER TABLE "Tournament" ADD COLUMN "paymentLink" TEXT;

CREATE TABLE "TournamentRegistration" (
  "id" SERIAL NOT NULL,
  "tournamentId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "rg" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "checkedIn" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TournamentRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_email_key" ON "TournamentRegistration"("tournamentId", "email");

ALTER TABLE "TournamentRegistration"
  ADD CONSTRAINT "TournamentRegistration_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
