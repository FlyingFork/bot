-- CreateEnum
CREATE TYPE "PendingChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PendingChangeType" AS ENUM ('RAID_REGISTRATIONS', 'EVENT_IMPORT');

-- CreateTable
CREATE TABLE "pending_changes" (
    "id" TEXT NOT NULL,
    "type" "PendingChangeType" NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "PendingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "submitter_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_changes_status_created_at_idx" ON "pending_changes"("status", "created_at");

-- AddForeignKey
ALTER TABLE "pending_changes" ADD CONSTRAINT "pending_changes_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_changes" ADD CONSTRAINT "pending_changes_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
