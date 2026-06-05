ALTER TABLE "PlayerAccount" ADD COLUMN "password" TEXT;
ALTER TABLE "PlayerAccount" ADD COLUMN "noticesAcceptedAt" TIMESTAMP(3);
ALTER TABLE "PlayerAccount" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlayerAccount" ADD COLUMN "verifyToken" TEXT;
CREATE UNIQUE INDEX "PlayerAccount_verifyToken_key" ON "PlayerAccount"("verifyToken");
