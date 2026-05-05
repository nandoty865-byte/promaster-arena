/*
  Warnings:

  - A unique constraint covering the columns `[publicSlug]` on the table `Tournament` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "organizationId" INTEGER,
ADD COLUMN     "publicSlug" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizationId" INTEGER;

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_publicSlug_key" ON "Tournament"("publicSlug");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
