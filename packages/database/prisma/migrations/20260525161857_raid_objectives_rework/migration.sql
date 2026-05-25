/*
  Warnings:

  - You are about to drop the column `name` on the `reservoir_raid_objectives` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `reservoir_raid_objectives` table. All the data in the column will be lost.
  - Added the required column `key` to the `reservoir_raid_objectives` table without a default value. This is not possible if the table is not empty.
  - Added the required column `map_x` to the `reservoir_raid_objectives` table without a default value. This is not possible if the table is not empty.
  - Added the required column `map_y` to the `reservoir_raid_objectives` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tier` to the `reservoir_raid_objectives` table without a default value. This is not possible if the table is not empty.
  - Added the required column `water_rate` to the `reservoir_raid_objectives` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "reservoir_raid_assignments_objective_id_participant_id_key";

-- AlterTable
ALTER TABLE "reservoir_raid_objectives" DROP COLUMN "name",
DROP COLUMN "type",
ADD COLUMN     "is_assignable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "map_x" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "map_y" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "tier" INTEGER NOT NULL,
ADD COLUMN     "water_rate" INTEGER NOT NULL;
