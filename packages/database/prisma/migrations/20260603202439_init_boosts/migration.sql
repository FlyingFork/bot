-- CreateEnum
CREATE TYPE "BoostType" AS ENUM ('CONSTRUCTION', 'RESEARCH');

-- AlterTable
ALTER TABLE "alliance_settings" ADD COLUMN     "boost_priority_mode" TEXT NOT NULL DEFAULT 'TIME',
ADD COLUMN     "boost_weight_power" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "boost_weight_time" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- CreateTable
CREATE TABLE "boost_tasks" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "type" "BoostType" NOT NULL,
    "total_duration_seconds" BIGINT NOT NULL,
    "boost_seconds_applied" BIGINT NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "boost_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boost_actions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "applied_by_id" TEXT NOT NULL,
    "boost_percentage" INTEGER NOT NULL,
    "seconds_reduced" BIGINT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldown_ends_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boost_actions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "boost_tasks" ADD CONSTRAINT "boost_tasks_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "alliance_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boost_actions" ADD CONSTRAINT "boost_actions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "boost_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boost_actions" ADD CONSTRAINT "boost_actions_applied_by_id_fkey" FOREIGN KEY ("applied_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
