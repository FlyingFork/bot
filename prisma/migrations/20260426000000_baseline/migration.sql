-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "TranslationGroup" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TranslationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationChannel" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "webhookId" TEXT,
    "webhookToken" TEXT,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "TranslationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationStat" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TranslationStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranslationGroup_guildId_name_key" ON "TranslationGroup"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationChannel_channelId_key" ON "TranslationChannel"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationStat_guildId_channelId_date_key" ON "TranslationStat"("guildId", "channelId", "date");

-- AddForeignKey
ALTER TABLE "TranslationChannel" ADD CONSTRAINT "TranslationChannel_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TranslationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
