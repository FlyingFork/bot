/*
  Warnings:

  - You are about to drop the `ReactionRoleEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReactionRolePanel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReactionRoleEntry" DROP CONSTRAINT "ReactionRoleEntry_panelId_fkey";

-- DropTable
DROP TABLE "ReactionRoleEntry";

-- DropTable
DROP TABLE "ReactionRolePanel";
