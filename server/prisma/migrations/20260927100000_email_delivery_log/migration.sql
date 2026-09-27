CREATE TYPE "EmailDeliveryStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL,
    "safeError" TEXT,
    "grievanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDelivery_grievanceId_createdAt_idx" ON "EmailDelivery"("grievanceId", "createdAt");
CREATE INDEX "EmailDelivery_event_status_createdAt_idx" ON "EmailDelivery"("event", "status", "createdAt");

ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_grievanceId_fkey"
FOREIGN KEY ("grievanceId") REFERENCES "Grievance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
