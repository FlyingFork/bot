-- Preserve the prototype singleton plan tables before weekly plans replace them.
ALTER TABLE "reservoir_raid_assignments"
RENAME TO "reservoir_raid_assignments_legacy";

ALTER TABLE "reservoir_raid_plan"
RENAME TO "reservoir_raid_plan_legacy";

ALTER TABLE "reservoir_raid_assignments_legacy"
RENAME CONSTRAINT "reservoir_raid_assignments_pkey"
TO "reservoir_raid_assignments_legacy_pkey";

ALTER TABLE "reservoir_raid_plan_legacy"
RENAME CONSTRAINT "reservoir_raid_plan_pkey"
TO "reservoir_raid_plan_legacy_pkey";

ALTER INDEX "reservoir_raid_assignments_plan_id_objective_id_member_id_key"
RENAME TO "reservoir_raid_assignments_legacy_plan_objective_member_key";

ALTER INDEX "reservoir_raid_assignments_plan_id_objective_id_idx"
RENAME TO "reservoir_raid_assignments_legacy_plan_objective_idx";

CREATE TYPE "ReservoirRaidContactType" AS ENUM ('DISCORD', 'TELEGRAM');

CREATE TABLE "reservoir_raid_plan" (
    "id" TEXT NOT NULL,
    "raid_date" DATE NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "public_token" TEXT NOT NULL,
    "registration_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservoir_raid_plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservoir_raid_participants" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "member_id" TEXT,
    "username" TEXT NOT NULL,
    "contact_type" "ReservoirRaidContactType",
    "contact" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservoir_raid_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservoir_raid_squad_powers" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "member_id" TEXT,
    "squad_index" INTEGER NOT NULL,
    "power" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservoir_raid_squad_powers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservoir_raid_assignments" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,

    CONSTRAINT "reservoir_raid_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservoir_raid_plan_raid_date_key"
ON "reservoir_raid_plan"("raid_date");

CREATE UNIQUE INDEX "reservoir_raid_plan_public_token_key"
ON "reservoir_raid_plan"("public_token");

CREATE UNIQUE INDEX "reservoir_raid_participants_plan_id_username_key"
ON "reservoir_raid_participants"("plan_id", "username");

CREATE INDEX "reservoir_raid_participants_plan_id_member_id_idx"
ON "reservoir_raid_participants"("plan_id", "member_id");

CREATE UNIQUE INDEX "reservoir_raid_squad_powers_participant_id_squad_index_key"
ON "reservoir_raid_squad_powers"("participant_id", "squad_index");

CREATE INDEX "reservoir_raid_squad_powers_member_id_created_at_idx"
ON "reservoir_raid_squad_powers"("member_id", "created_at");

CREATE UNIQUE INDEX "reservoir_raid_assignments_plan_id_objective_id_participant_id_key"
ON "reservoir_raid_assignments"("plan_id", "objective_id", "participant_id");

CREATE INDEX "reservoir_raid_assignments_plan_id_objective_id_idx"
ON "reservoir_raid_assignments"("plan_id", "objective_id");

ALTER TABLE "reservoir_raid_participants"
ADD CONSTRAINT "reservoir_raid_participants_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "reservoir_raid_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservoir_raid_participants"
ADD CONSTRAINT "reservoir_raid_participants_member_id_fkey"
FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservoir_raid_squad_powers"
ADD CONSTRAINT "reservoir_raid_squad_powers_participant_id_fkey"
FOREIGN KEY ("participant_id") REFERENCES "reservoir_raid_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservoir_raid_squad_powers"
ADD CONSTRAINT "reservoir_raid_squad_powers_member_id_fkey"
FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservoir_raid_assignments"
ADD CONSTRAINT "reservoir_raid_assignments_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "reservoir_raid_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservoir_raid_assignments"
ADD CONSTRAINT "reservoir_raid_assignments_participant_id_fkey"
FOREIGN KEY ("participant_id") REFERENCES "reservoir_raid_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
