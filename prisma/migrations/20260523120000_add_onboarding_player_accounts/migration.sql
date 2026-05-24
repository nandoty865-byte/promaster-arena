ALTER TABLE "Organization" ADD COLUMN "documentType" TEXT;
ALTER TABLE "Organization" ADD COLUMN "documentNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN "kycStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Organization" ADD COLUMN "kycDocumentUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "paymentCollectionMode" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Organization" ADD COLUMN "supportedSports" TEXT;

CREATE TABLE "PlayerAccount" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "nickname" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "rg" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "favoriteSports" TEXT,
  "termsAcceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlayerAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerAccount_email_key" ON "PlayerAccount"("email");
