import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const apply = process.argv.includes("--apply");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

function key(planId, username) {
  return `${planId}\u0000${username}`;
}

async function main() {
  await client.connect();

  const duelCountResult = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM alliance_duel_scores score
    JOIN alliance_members member ON member.id = score.member_id
    WHERE score.side = 'ALLY'
      AND score.member_id IS NOT NULL
      AND score.player_name IS DISTINCT FROM member.username
  `);
  const duelRowsToUpdate = duelCountResult.rows[0]?.count ?? 0;

  const raidResult = await client.query(`
    SELECT
      participant.id,
      participant.plan_id AS "planId",
      participant.username,
      member.username AS "memberUsername"
    FROM reservoir_raid_participants participant
    JOIN alliance_members member ON member.id = participant.member_id
    WHERE participant.username IS DISTINCT FROM member.username
  `);

  const allRaidRowsResult = await client.query(`
    SELECT id, plan_id AS "planId", username
    FROM reservoir_raid_participants
  `);

  const targetCounts = new Map();
  for (const row of raidResult.rows) {
    const targetKey = key(row.planId, row.memberUsername);
    targetCounts.set(targetKey, (targetCounts.get(targetKey) ?? 0) + 1);
  }

  const raidUpdates = [];
  const raidSkips = [];
  for (const row of raidResult.rows) {
    const targetKey = key(row.planId, row.memberUsername);
    const duplicateTarget = targetCounts.get(targetKey) > 1;
    const existingNameConflict = allRaidRowsResult.rows.some(
      (existing) =>
        existing.planId === row.planId &&
        existing.id !== row.id &&
        existing.username === row.memberUsername,
    );

    if (duplicateTarget || existingNameConflict) {
      raidSkips.push({
        id: row.id,
        planId: row.planId,
        current: row.username,
        target: row.memberUsername,
        reason: duplicateTarget ? "multiple rows map to target name" : "target name already exists in plan",
      });
    } else {
      raidUpdates.push(row);
    }
  }

  console.log(apply ? "Applying event member name sync..." : "Dry run: event member name sync");
  console.log(`Alliance Duel ally score rows to update: ${duelRowsToUpdate}`);
  console.log(`Reservoir Raid participant rows to update: ${raidUpdates.length}`);
  console.log(`Reservoir Raid participant rows skipped: ${raidSkips.length}`);

  if (raidSkips.length > 0) {
    console.table(raidSkips.slice(0, 20));
    if (raidSkips.length > 20) {
      console.log(`...and ${raidSkips.length - 20} more skipped rows.`);
    }
  }

  if (!apply) {
    console.log("No changes were written. Re-run with --apply to update the database.");
    return;
  }

  await client.query("BEGIN");
  try {
    const duelUpdate = await client.query(`
      UPDATE alliance_duel_scores score
      SET player_name = member.username
      FROM alliance_members member
      WHERE score.member_id = member.id
        AND score.side = 'ALLY'
        AND score.member_id IS NOT NULL
        AND score.player_name IS DISTINCT FROM member.username
    `);

    let raidUpdated = 0;
    for (const row of raidUpdates) {
      const result = await client.query(
        `
          UPDATE reservoir_raid_participants
          SET username = $1
          WHERE id = $2
            AND username IS DISTINCT FROM $1
        `,
        [row.memberUsername, row.id],
      );
      raidUpdated += result.rowCount ?? 0;
    }

    await client.query("COMMIT");
    console.log(`Updated Alliance Duel rows: ${duelUpdate.rowCount ?? 0}`);
    console.log(`Updated Reservoir Raid rows: ${raidUpdated}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
