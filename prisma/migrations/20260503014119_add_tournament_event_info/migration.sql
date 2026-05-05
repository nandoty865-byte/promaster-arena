-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "eventDate" TIMESTAMP(3),
ADD COLUMN     "eventTime" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "prize" TEXT,
ADD COLUMN     "rules" TEXT;
