ALTER TABLE "TournamentRegistration"
ALTER COLUMN "paymentMethod" DROP DEFAULT,
ALTER COLUMN "paymentMethod" DROP NOT NULL;

UPDATE "TournamentRegistration"
SET "paymentMethod" = NULL
WHERE "paymentStatus" IS NULL
   OR "paymentStatus" <> 'paid';
