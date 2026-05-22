-- Existing weekly registrations remain unassigned to the event roster by default.
ALTER TABLE "reservoir_raid_participants"
ADD COLUMN "participant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reservist" BOOLEAN NOT NULL DEFAULT false,
ADD CONSTRAINT "reservoir_raid_participants_single_roster_slot_check"
CHECK (NOT ("participant" AND "reservist"));
