ALTER TABLE "User"
ADD COLUMN "whatsappVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappVerifyCode" TEXT,
ADD COLUMN "whatsappVerifyExpiresAt" TIMESTAMP(3),
ADD COLUMN "whatsappVerifyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "whatsappLastSentAt" TIMESTAMP(3),
ADD COLUMN "profileIntent" TEXT,
ADD COLUMN "signupSource" TEXT,
ADD COLUMN "termsVersion" TEXT,
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyVersion" TEXT,
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsCheckboxText" TEXT,
ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN "signupIp" TEXT,
ADD COLUMN "signupUserAgent" TEXT,
ADD COLUMN "basicAccessGrantedAt" TIMESTAMP(3);

UPDATE "User"
SET
  "whatsappVerified" = COALESCE("whatsappVerified", false),
  "marketingConsent" = COALESCE("marketingConsent", false),
  "basicAccessGrantedAt" = COALESCE("basicAccessGrantedAt", CASE WHEN "emailVerified" = true THEN CURRENT_TIMESTAMP ELSE NULL END);
