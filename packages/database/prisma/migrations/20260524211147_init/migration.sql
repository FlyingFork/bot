/*
  Warnings:

  - You are about to drop the column `createdAt` on the `audit_log` table. All the data in the column will be lost.
  - You are about to drop the `reservoir_raid_assignments_legacy` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reservoir_raid_plan_legacy` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[participant_id]` on the table `reservoir_raid_assignments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[objective_id,participant_id]` on the table `reservoir_raid_assignments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[alliance_member_id]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `event_type` on the `alliance_event_imports` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `event_type` on the `alliance_event_snapshots` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PlatformUserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'TEMP_AWAY', 'LEFT');

-- CreateEnum
CREATE TYPE "LeaderboardType" AS ENUM ('SOLO_POWER', 'BATTLE_VANGUARD', 'HEADQUARTERS', 'HERO', 'HERO_POWER', 'BEHEMOTH_RANKINGS', 'EXPLORATION_RANKINGS', 'COLLECTION', 'ALLIANCE_PLAYER_LIST');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('UPLOAD_SUBMITTED', 'UPLOAD_APPROVED', 'UPLOAD_REJECTED', 'ACCOUNT_VERIFIED', 'EVENT_CREATED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "DuelOutcome" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'SELECTED_PARTICIPANT', 'SELECTED_RESERVIST', 'NOT_SELECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PendingChangeType" ADD VALUE 'LEADERBOARD_SNAPSHOT';
ALTER TYPE "PendingChangeType" ADD VALUE 'ALLIANCE_DUEL_DAY';
ALTER TYPE "PendingChangeType" ADD VALUE 'RESERVOIR_RAID_RESULTS';

-- DropForeignKey
ALTER TABLE "reservoir_raid_assignments_legacy" DROP CONSTRAINT "reservoir_raid_assignments_member_id_fkey";

-- DropForeignKey
ALTER TABLE "reservoir_raid_assignments_legacy" DROP CONSTRAINT "reservoir_raid_assignments_plan_id_fkey";

-- DropIndex
DROP INDEX "reservoir_raid_assignments_plan_id_objective_id_participant_id_";

-- AlterTable
ALTER TABLE "alliance_event_imports" DROP COLUMN "event_type",
ADD COLUMN     "event_type" "LeaderboardType" NOT NULL;

-- AlterTable
ALTER TABLE "alliance_event_snapshots" DROP COLUMN "event_type",
ADD COLUMN     "event_type" "LeaderboardType" NOT NULL;

-- AlterTable
ALTER TABLE "alliance_members" ADD COLUMN     "is_temp_away" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joined_at" TIMESTAMP(3),
ADD COLUMN     "left_at" TIMESTAMP(3),
ADD COLUMN     "member_status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "temp_away_alliance_tag" TEXT;

-- AlterTable
ALTER TABLE "alliance_settings" ADD COLUMN     "contrib_weight_duel" INTEGER NOT NULL DEFAULT 35,
ADD COLUMN     "contrib_weight_power" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "contrib_weight_raid" INTEGER NOT NULL DEFAULT 35,
ADD COLUMN     "stale_alliance_player_list" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "stale_battle_vanguard" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "stale_behemoth" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "stale_collection" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "stale_exploration" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "stale_headquarters" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "stale_hero" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "stale_hero_power" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "stale_solo_power" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "audit_log" DROP COLUMN "createdAt",
ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entity_type" TEXT;

-- AlterTable
ALTER TABLE "pending_changes" ADD COLUMN     "diff_data" JSONB,
ADD COLUMN     "event_day" INTEGER,
ADD COLUMN     "event_instance_id" TEXT,
ADD COLUMN     "event_instance_type" TEXT,
ADD COLUMN     "leaderboard_type" "LeaderboardType",
ADD COLUMN     "rejection_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reservoir_raid_participants" ADD COLUMN     "registration_status" "RegistrationStatus" NOT NULL DEFAULT 'UNMATCHED',
ADD COLUMN     "water_collected" INTEGER;

-- AlterTable
ALTER TABLE "reservoir_raid_plan" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "alliance_member_id" TEXT,
ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'en',
ADD COLUMN     "platform_status" "PlatformUserStatus" NOT NULL DEFAULT 'PENDING';

-- DropTable
DROP TABLE "reservoir_raid_assignments_legacy";

-- DropTable
DROP TABLE "reservoir_raid_plan_legacy";

-- DropEnum
DROP TYPE "AllianceEventType";

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_name_history" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_name_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "type" "LeaderboardType" NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_request_id" TEXT,
    "season_id" TEXT,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "member_id" TEXT,
    "rank" INTEGER,
    "player_name" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alliance_duel_instances" (
    "id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "opponent_tag" TEXT,
    "opponent_name" TEXT,
    "outcome" "DuelOutcome",
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alliance_duel_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alliance_duel_days" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "point_value" INTEGER NOT NULL,
    "has_data" BOOLEAN NOT NULL DEFAULT false,
    "day_outcome" "DuelOutcome",
    "change_request_id" TEXT,

    CONSTRAINT "alliance_duel_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alliance_duel_scores" (
    "id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "alliance_duel_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservoir_raid_objectives" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "reservoir_raid_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "member_name_history_member_id_idx" ON "member_name_history"("member_id");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_type_captured_at_idx" ON "leaderboard_snapshots"("type", "captured_at");

-- CreateIndex
CREATE INDEX "leaderboard_entries_snapshot_id_idx" ON "leaderboard_entries"("snapshot_id");

-- CreateIndex
CREATE INDEX "leaderboard_entries_member_id_idx" ON "leaderboard_entries"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "alliance_duel_days_instance_id_day_number_key" ON "alliance_duel_days"("instance_id", "day_number");

-- CreateIndex
CREATE INDEX "alliance_duel_scores_member_id_idx" ON "alliance_duel_scores"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "alliance_duel_scores_day_id_member_id_key" ON "alliance_duel_scores"("day_id", "member_id");

-- CreateIndex
CREATE INDEX "reservoir_raid_objectives_plan_id_idx" ON "reservoir_raid_objectives"("plan_id");

-- CreateIndex
CREATE INDEX "alliance_event_imports_event_type_created_at_idx" ON "alliance_event_imports"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "alliance_event_snapshots_member_id_event_type_imported_at_idx" ON "alliance_event_snapshots"("member_id", "event_type", "imported_at");

-- CreateIndex
CREATE INDEX "alliance_event_snapshots_event_type_imported_at_idx" ON "alliance_event_snapshots"("event_type", "imported_at");

-- CreateIndex
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_targetId_idx" ON "audit_log"("entity_type", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "reservoir_raid_assignments_participant_id_key" ON "reservoir_raid_assignments"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservoir_raid_assignments_objective_id_participant_id_key" ON "reservoir_raid_assignments"("objective_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_alliance_member_id_key" ON "user"("alliance_member_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_alliance_member_id_fkey" FOREIGN KEY ("alliance_member_id") REFERENCES "alliance_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_name_history" ADD CONSTRAINT "member_name_history_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "leaderboard_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alliance_duel_days" ADD CONSTRAINT "alliance_duel_days_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "alliance_duel_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alliance_duel_scores" ADD CONSTRAINT "alliance_duel_scores_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "alliance_duel_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alliance_duel_scores" ADD CONSTRAINT "alliance_duel_scores_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservoir_raid_objectives" ADD CONSTRAINT "reservoir_raid_objectives_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "reservoir_raid_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservoir_raid_assignments" ADD CONSTRAINT "reservoir_raid_assignments_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "reservoir_raid_objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
