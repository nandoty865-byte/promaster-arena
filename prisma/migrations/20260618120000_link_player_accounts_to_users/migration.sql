ALTER TABLE "PlayerAccount" ADD COLUMN "userId" INTEGER;

UPDATE "PlayerAccount" AS pa
SET "userId" = u."id"
FROM "User" AS u
WHERE LOWER(u."email") = LOWER(pa."email")
  AND pa."userId" IS NULL;

INSERT INTO "User" (
  "name",
  "email",
  "password",
  "role",
  "createdAt",
  "phone",
  "emailVerified",
  "emailVerifyToken"
)
SELECT
  pa."name",
  pa."email",
  pa."password",
  'player',
  pa."createdAt",
  pa."phone",
  pa."emailVerified",
  NULL
FROM "PlayerAccount" AS pa
WHERE pa."password" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS u
    WHERE LOWER(u."email") = LOWER(pa."email")
  );

UPDATE "PlayerAccount" AS pa
SET "userId" = u."id"
FROM "User" AS u
WHERE LOWER(u."email") = LOWER(pa."email")
  AND pa."userId" IS NULL;

CREATE UNIQUE INDEX "PlayerAccount_userId_key" ON "PlayerAccount"("userId");

ALTER TABLE "PlayerAccount"
ADD CONSTRAINT "PlayerAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
