-- CreateTable
CREATE TABLE "reservoir_raid_plan" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservoir_raid_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservoir_raid_assignments" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,

    CONSTRAINT "reservoir_raid_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservoir_raid_assignments_plan_id_objective_id_member_id_key"
ON "reservoir_raid_assignments"("plan_id", "objective_id", "member_id");

-- CreateIndex
CREATE INDEX "reservoir_raid_assignments_plan_id_objective_id_idx"
ON "reservoir_raid_assignments"("plan_id", "objective_id");

-- AddForeignKey
ALTER TABLE "reservoir_raid_assignments"
ADD CONSTRAINT "reservoir_raid_assignments_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "reservoir_raid_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservoir_raid_assignments"
ADD CONSTRAINT "reservoir_raid_assignments_member_id_fkey"
FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
