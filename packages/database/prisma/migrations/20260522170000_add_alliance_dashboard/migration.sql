-- CreateEnum
CREATE TYPE "AllianceRank" AS ENUM ('R5', 'R4', 'R3', 'R2', 'R1');

-- CreateEnum
CREATE TYPE "AllianceEventType" AS ENUM ('ALLIANCE_SIEGE', 'EXPLORATION');

-- CreateTable
CREATE TABLE "alliance_settings" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "name" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alliance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alliance_members" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "current_rank" "AllianceRank",
    "current_power" BIGINT,
    "current_power_plant_level" INTEGER,
    "last_roster_imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alliance_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alliance_roster_imports" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alliance_roster_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alliance_roster_snapshots" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "power" BIGINT NOT NULL,
    "power_plant_level" INTEGER NOT NULL,
    "rank" "AllianceRank" NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alliance_roster_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alliance_event_imports" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "event_type" "AllianceEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alliance_event_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alliance_event_snapshots" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "event_type" "AllianceEventType" NOT NULL,
    "power" BIGINT NOT NULL,
    "exploration_level" INTEGER,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alliance_event_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alliance_members_username_key" ON "alliance_members"("username");

-- CreateIndex
CREATE INDEX "alliance_members_active_current_power_idx" ON "alliance_members"("active", "current_power");

-- CreateIndex
CREATE INDEX "alliance_roster_imports_created_at_idx" ON "alliance_roster_imports"("created_at");

-- CreateIndex
CREATE INDEX "alliance_roster_snapshots_member_id_imported_at_idx" ON "alliance_roster_snapshots"("member_id", "imported_at");

-- CreateIndex
CREATE INDEX "alliance_event_imports_event_type_created_at_idx" ON "alliance_event_imports"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "alliance_event_snapshots_member_id_event_type_imported_at_idx" ON "alliance_event_snapshots"("member_id", "event_type", "imported_at");

-- CreateIndex
CREATE INDEX "alliance_event_snapshots_event_type_imported_at_idx" ON "alliance_event_snapshots"("event_type", "imported_at");

-- AddForeignKey
ALTER TABLE "alliance_roster_snapshots" ADD CONSTRAINT "alliance_roster_snapshots_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "alliance_roster_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alliance_roster_snapshots" ADD CONSTRAINT "alliance_roster_snapshots_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alliance_event_snapshots" ADD CONSTRAINT "alliance_event_snapshots_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "alliance_event_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alliance_event_snapshots" ADD CONSTRAINT "alliance_event_snapshots_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
