-- AlterTable
ALTER TABLE "alliance_settings" ADD COLUMN     "boost_min_days_construction" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "boost_min_days_research" INTEGER NOT NULL DEFAULT 0;
