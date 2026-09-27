-- Add optional Department Admin assignment support while preserving every
-- existing officer assignment. Existing officerId values remain unchanged.
ALTER TABLE "GrievanceAssignment"
  ALTER COLUMN "officerId" DROP NOT NULL;

ALTER TABLE "GrievanceAssignment"
  ADD COLUMN "departmentAdminId" TEXT;

CREATE INDEX "GrievanceAssignment_departmentAdminId_active_idx"
  ON "GrievanceAssignment"("departmentAdminId", "active");

ALTER TABLE "GrievanceAssignment"
  ADD CONSTRAINT "GrievanceAssignment_departmentAdminId_fkey"
  FOREIGN KEY ("departmentAdminId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
