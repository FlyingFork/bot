-- AlterTable
ALTER TABLE "boost_actions" ADD COLUMN     "type" "BoostType",
ALTER COLUMN "task_id" DROP NOT NULL;
