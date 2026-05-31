// AI prompt templates for each upload type.
// Edit the strings below to customise what gets sent to the AI.
//
// Placeholders replaced automatically before the user copies the prompt:
//   {{allianceTag}}   — your alliance's primary tag, e.g. "TLS"
//   {{tempAwayTags}}  — comma-separated "[TAG] PlayerName" entries for temp-away members, or "-" if none
//   {{schema}}        — the expected JSON field structure for this upload type

export const UPLOAD_PROMPTS = {
  SOLO_POWER: `Parse the attached screenshot of the Solo Power leaderboard and return a JSON array.
Include all visible players whose alliance tag matches: [{{allianceTag}}]
Also include players temporarily in these alliances: {{tempAwayTags}}
Each entry must follow this format: {{schema}}
The names don't have new lines, it's just raw text, don't include the alliance tag. The number formated with K or M or something like that is the power.
Convert any shorthand numbers (K, M, B) in the leadeboard into raw, full integers with no letters or commas (e.g., 5K -> 5000, 98.74M -> 98740000).
"totalPower" is each member's individual total power as a plain number (no abbreviations, e.g., 5K -> 5000, 98.74M -> 98740000).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  BATTLE_VANGUARD: `Parse the attached screenshot of the Battle Vanguard (kills) leaderboard and return a JSON array.
Include all visible players whose alliance tag matches: {{allianceTag}}
Also include players temporarily in these alliances: {{tempAwayTags}}
Each entry must follow this format: {{schema}}
The names don't have new lines, it's just raw text, don't include the alliance tag. The number formated with K or M or something like that is the kills.
Convert any shorthand numbers (K, M, B) in the leadeboard into raw, full integers with no letters or commas (e.g., 5K -> 5000, 98.74M -> 98740000).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  HEADQUARTERS: `Parse the attached screenshot of the Headquarters leaderboard and return a JSON array.
Include all visible players whose alliance tag matches: {{allianceTag}}
Also include players temporarily in these alliances: {{tempAwayTags}}
Each entry must follow this format: {{schema}}
The names don't have new lines, it's just raw text, don't include the alliance tag.
"powerPlantLevel" is the level of the Power Plant building (plain integer).
"otherBuildingsLevel" is the level shown for the other buildings column (plain integer).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  HERO: `Parse the attached screenshot of the Hero leaderboard and return a JSON array.
Include all visible players whose alliance tag matches: {{allianceTag}}
Also include players temporarily in these alliances: {{tempAwayTags}}
Each entry must follow this format: {{schema}}
The names of the players don't have new lines, it's just raw text, don't include the alliance tag.
"heroName" is the name of the hero shown for that player (string, exactly as displayed).
"heroPower" is that hero's power value as a plain number (no abbreviations).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  HERO_POWER: `Parse the attached screenshot of the Hero Power leaderboard and return a JSON array.
Include all visible players whose alliance tag matches: {{allianceTag}}
Also include players temporarily in these alliances: {{tempAwayTags}}
Each entry must follow this format: {{schema}}
The names of the players don't have new lines, it's just raw text, don't include the alliance tag. The number formated with K or M or something like that is the kills.
Convert any shorthand numbers (K, M, B) in the leadeboard into raw, full integers with no letters or commas (e.g., 5K -> 5000, 98.74M -> 98740000).
"totalHeroPower" is the player's combined hero power as a plain number (no abbreviations).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  BEHEMOTH_RANKINGS: `Parse the attached screenshot of the Behemoth Rankings leaderboard and return a JSON array.
Include all visible players whose alliance tag matches: {{allianceTag}}
Also include players temporarily in these alliances: {{tempAwayTags}}
Each entry must follow this format: {{schema}}
The names of the players don't have new lines, it's just raw text, don't include the alliance tag. The number formated with K or M or something like that is the kills.
Convert any shorthand numbers (K, M, B) in the leadeboard into raw, full integers with no letters or commas (e.g., 5K -> 5000, 98.74M -> 98740000).
"behemothPower" is the player's behemoth power value as a plain number (no abbreviations).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  EXPLORATION_RANKINGS: `Parse the attached screenshot of the Exploration Rankings leaderboard and return a JSON array.
Include all visible players whose alliance tag matches: {{allianceTag}}
Also include players temporarily in these alliances: {{tempAwayTags}}
Each entry must follow this format: {{schema}}
The names of the players don't have new lines, it's just raw text, don't include the alliance tag.
"explorationLevel" is the player's exploration level as a plain integer.
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  COLLECTION: `Parse the attached screenshot of the Collection Power leaderboard and return a JSON array.
Include all visible players whose alliance tag matches: {{allianceTag}}
Also include players temporarily in these alliances: {{tempAwayTags}}
Each entry must follow this format: {{schema}}
The names of the players don't have new lines, it's just raw text, don't include the alliance tag. The number formated with K or M or something like that is the kills.
Convert any shorthand numbers (K, M, B) in the leadeboard into raw, full integers with no letters or commas (e.g., 5K -> 5000, 98.74M -> 98740000).
"collectionPower" is the player's collection power as a plain number (no abbreviations).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  ALLIANCE_PLAYER_LIST: `Parse the attached screenshot of the Alliance member list and return a JSON array.
Each entry must follow this format: {{schema}}
"allianceRank" is the player's rank in the alliance — one of: R1, R2, R3, R4, R5 (string, exactly as listed).
"totalPower" is each member's individual total power as a plain number (no abbreviations, e.g., 5K -> 5000, 98.74M -> 98740000).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  ALLIANCE_DUEL_DAY: `Parse the attached screenshot of the Alliance Duel daily results and return a JSON array.
Each entry must follow this format: {{schema}}
"side" is "ALLY" for our alliance players (players with tag [{{allianceTag}}]) and "ENEMY" for opponent players. If only our alliance is visible, use "ALLY".
The names of the players don't have new lines, it's just raw text, don't include the alliance tag only for allies.
"points" is the number of points the player scored on this duel day (plain integer).
Return ONLY the JSON array as an embed so it's easy to copy, no extra text.`,

  RESERVOIR_RAID_RESULTS: `Parse the attached screenshot of the Reservoir Raid results and return a JSON array.
Include every visible player regardless of alliance — do not filter by tag.
Each entry must follow this format: {{schema}}
"waterCollected" is the total amount of water each player collected (plain number, no abbreviations).
Return ONLY the JSON array, no markdown, no extra text.`,
} as const;

export type UploadPromptKey = keyof typeof UPLOAD_PROMPTS;

export const RAID_REGISTRATION_PROMPT = `Parse the attached screenshot of the Reservoir Raid sign-up or participant list and return a JSON array.
Include every visible player that is either a participant or reservist, do not include players that do not have at least checkbox checked.
Each entry must follow this format: [{ "name": "PlayerName", "participant": true, "reservist": false }]
The names of the players don't have new lines, it's just raw text, don't include the alliance tag.
"participant" is true if the player is listed as a main participant, false otherwise.
"reservist" is true if the player is listed as a reservist or backup, false otherwise.
If a player is neither, set both to false. The participant is the first checkbox and reservist is the second checkbox on the X axis.
Return ONLY the JSON array, no markdown, no extra text.`;
