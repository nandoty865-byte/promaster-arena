ALTER TABLE "TournamentRegistration" ADD COLUMN "automaticPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TournamentRegistration" ADD COLUMN "mercadoPagoId" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "paymentTicketUrl" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "paymentQrCode" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "paymentQrCodeBase64" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "representsOrganization" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TournamentRegistration" ADD COLUMN "representedOrganizationName" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "representedOrganizationType" TEXT;
ALTER TABLE "TournamentRegistration" ADD COLUMN "representedOrganizationDocument" TEXT;
