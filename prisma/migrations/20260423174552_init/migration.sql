-- CreateTable
CREATE TABLE "ChannelGroup" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,

    CONSTRAINT "ChannelGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelWebhook" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "webhookToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionRolePanel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionRolePanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionRoleEntry" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,

    CONSTRAINT "ReactionRoleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelGroupMember_channelId_groupId_key" ON "ChannelGroupMember"("channelId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelWebhook_channelId_key" ON "ChannelWebhook"("channelId");

-- AddForeignKey
ALTER TABLE "ChannelGroupMember" ADD CONSTRAINT "ChannelGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChannelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactionRoleEntry" ADD CONSTRAINT "ReactionRoleEntry_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "ReactionRolePanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
