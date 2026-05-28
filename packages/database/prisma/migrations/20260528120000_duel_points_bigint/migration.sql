ALTER TABLE "alliance_duel_scores"
  ALTER COLUMN "points" TYPE BIGINT;

ALTER TABLE "alliance_duel_days"
  ALTER COLUMN "ally_total_points" TYPE BIGINT,
  ALTER COLUMN "enemy_total_points" TYPE BIGINT;
