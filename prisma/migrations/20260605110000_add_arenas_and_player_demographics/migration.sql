ALTER TABLE "PlayerAccount"
ADD COLUMN "gender" TEXT,
ADD COLUMN "birthDate" TIMESTAMP(3);

CREATE TABLE "Arena" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "website" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "country" TEXT,
  "zipCode" TEXT,
  "street" TEXT,
  "number" TEXT,
  "complement" TEXT,
  "neighborhood" TEXT,
  "city" TEXT,
  "state" TEXT,
  "responsibleName" TEXT,
  "responsibleCpf" TEXT,
  "responsiblePhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Arena_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Arena_organizationId_idx" ON "Arena"("organizationId");

ALTER TABLE "Arena"
ADD CONSTRAINT "Arena_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
