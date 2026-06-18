CREATE TABLE "UserRole" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");
CREATE INDEX "UserRole_role_idx" ON "UserRole"("role");

ALTER TABLE "UserRole"
ADD CONSTRAINT "UserRole_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserRole" ("userId", "role")
SELECT "id", 'SUPERADMIN'
FROM "User"
WHERE "role" = 'superadmin'
ON CONFLICT ("userId", "role") DO NOTHING;

INSERT INTO "UserRole" ("userId", "role")
SELECT "id", 'PLAYER'
FROM "User"
WHERE "role" = 'player'
   OR EXISTS (
    SELECT 1
    FROM "PlayerAccount" pa
    WHERE pa."userId" = "User"."id"
  )
ON CONFLICT ("userId", "role") DO NOTHING;

INSERT INTO "UserRole" ("userId", "role")
SELECT "id", 'ORGANIZER'
FROM "User"
WHERE "organizationId" IS NOT NULL
  AND "role" IN ('admin', 'operator', 'viewer')
ON CONFLICT ("userId", "role") DO NOTHING;

INSERT INTO "UserRole" ("userId", "role")
SELECT "id", 'ARENA_OWNER'
FROM "User"
WHERE "organizationId" IS NOT NULL
  AND "role" = 'admin'
ON CONFLICT ("userId", "role") DO NOTHING;

INSERT INTO "UserRole" ("userId", "role")
SELECT "id", 'ADMIN'
FROM "User"
WHERE "role" = 'admin'
ON CONFLICT ("userId", "role") DO NOTHING;
