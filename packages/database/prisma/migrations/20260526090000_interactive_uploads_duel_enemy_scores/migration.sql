-- Interactive upload resolutions, partial profiles, transferred members, and side-aware duel scores.

ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED';

CREATE TYPE "DuelSide" AS ENUM ('ALLY', 'ENEMY');

ALTER TABLE "alliance_members"
  ADD COLUMN "is_partial" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "pending_changes"
  ADD COLUMN "resolution_data" JSONB;

ALTER TABLE "alliance_duel_days"
  ADD COLUMN "ally_total_points" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "enemy_total_points" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "alliance_duel_scores"
  ADD COLUMN "side" "DuelSide" NOT NULL DEFAULT 'ALLY',
  ADD COLUMN "player_name" TEXT NOT NULL DEFAULT '';

UPDATE "alliance_duel_scores" score
SET "player_name" = COALESCE(member."username", '')
FROM "alliance_members" member
WHERE score."member_id" = member."id";

ALTER TABLE "alliance_duel_scores"
  ALTER COLUMN "member_id" DROP NOT NULL;

CREATE INDEX "alliance_duel_scores_day_id_side_idx"
  ON "alliance_duel_scores"("day_id", "side");

UPDATE "alliance_duel_days" day
SET "ally_total_points" = COALESCE((
  SELECT SUM(score."points")::INTEGER
  FROM "alliance_duel_scores" score
  WHERE score."day_id" = day."id" AND score."side" = 'ALLY'
), 0);
