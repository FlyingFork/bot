-- AlterEnum
ALTER TYPE "PendingChangeType" ADD VALUE 'RESERVOIR_RAID_SCORES';

-- AlterTable
ALTER TABLE "alliance_members" ADD COLUMN     "reservoir_raid_score" INTEGER,
ADD COLUMN     "reservoir_raid_score_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "reservoir_raid_score_history" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" TEXT,

    CONSTRAINT "reservoir_raid_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservoir_raid_score_history_member_id_recorded_at_idx" ON "reservoir_raid_score_history"("member_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "reservoir_raid_score_history" ADD CONSTRAINT "reservoir_raid_score_history_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
