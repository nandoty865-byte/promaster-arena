CREATE TABLE "audit_events" (
    "id" SERIAL NOT NULL,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'business',
    "entityType" TEXT,
    "entityId" TEXT,
    "organizationId" INTEGER,
    "tournamentId" INTEGER,
    "arenaId" INTEGER,
    "paymentId" INTEGER,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");
CREATE INDEX "audit_events_actorUserId_idx" ON "audit_events"("actorUserId");
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");
CREATE INDEX "audit_events_category_idx" ON "audit_events"("category");
CREATE INDEX "audit_events_severity_idx" ON "audit_events"("severity");
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");
CREATE INDEX "audit_events_organizationId_idx" ON "audit_events"("organizationId");
CREATE INDEX "audit_events_tournamentId_idx" ON "audit_events"("tournamentId");

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
