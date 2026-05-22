-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'ru', 'tr');

-- CreateEnum
CREATE TYPE "ReactionRoleStatus" AS ENUM ('PENDING', 'READY');

-- CreateTable
CREATE TABLE "guild_settings" (
    "guild_id" TEXT NOT NULL,
    "admin_log_channel_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_settings_pkey" PRIMARY KEY ("guild_id")
);

-- CreateTable
CREATE TABLE "translation_groups" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_channels" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "language" "Language" NOT NULL,

    CONSTRAINT "group_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_webhooks" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_maps" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "source_channel_id" TEXT NOT NULL,
    "source_message_id" TEXT NOT NULL,
    "target_channel_id" TEXT NOT NULL,
    "target_message_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_maps" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "source_thread_id" TEXT NOT NULL,
    "source_channel_id" TEXT NOT NULL,
    "target_thread_id" TEXT NOT NULL,
    "target_channel_id" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaction_role_messages" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "languages" "Language"[],
    "status" "ReactionRoleStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reaction_role_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaction_role_assignments" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reaction_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignment_audits" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "assigned" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignment_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_stats" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "source_channel_id" TEXT NOT NULL,
    "target_channel_id" TEXT NOT NULL,
    "source_language" "Language" NOT NULL,
    "target_language" "Language" NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "translated_messages" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_api_events" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT,
    "ok" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_api_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "translation_groups_guild_id_name_key" ON "translation_groups"("guild_id", "name");

-- CreateIndex
CREATE INDEX "group_channels_guild_id_channel_id_idx" ON "group_channels"("guild_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_channels_group_id_channel_id_key" ON "group_channels"("group_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_channels_group_id_language_key" ON "group_channels"("group_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "group_channels_guild_id_channel_id_language_key" ON "group_channels"("guild_id", "channel_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "managed_webhooks_guild_id_channel_id_key" ON "managed_webhooks"("guild_id", "channel_id");

-- CreateIndex
CREATE INDEX "message_maps_guild_id_source_channel_id_source_message_id_idx" ON "message_maps"("guild_id", "source_channel_id", "source_message_id");

-- CreateIndex
CREATE INDEX "message_maps_guild_id_target_channel_id_idx" ON "message_maps"("guild_id", "target_channel_id");

-- CreateIndex
CREATE INDEX "thread_maps_guild_id_source_thread_id_idx" ON "thread_maps"("guild_id", "source_thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "thread_maps_guild_id_group_id_source_thread_id_target_chann_key" ON "thread_maps"("guild_id", "group_id", "source_thread_id", "target_channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "reaction_role_messages_message_id_key" ON "reaction_role_messages"("message_id");

-- CreateIndex
CREATE INDEX "reaction_role_messages_guild_id_idx" ON "reaction_role_messages"("guild_id");

-- CreateIndex
CREATE INDEX "reaction_role_assignments_guild_id_role_id_idx" ON "reaction_role_assignments"("guild_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "reaction_role_assignments_message_id_language_key" ON "reaction_role_assignments"("message_id", "language");

-- CreateIndex
CREATE INDEX "role_assignment_audits_guild_id_user_id_idx" ON "role_assignment_audits"("guild_id", "user_id");

-- CreateIndex
CREATE INDEX "translation_stats_guild_id_created_at_idx" ON "translation_stats"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "translation_api_events_guild_id_created_at_idx" ON "translation_api_events"("guild_id", "created_at");

-- AddForeignKey
ALTER TABLE "group_channels" ADD CONSTRAINT "group_channels_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "translation_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaction_role_assignments" ADD CONSTRAINT "reaction_role_assignments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "reaction_role_messages"("message_id") ON DELETE CASCADE ON UPDATE CASCADE;
