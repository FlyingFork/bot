-- CreateEnum
CREATE TYPE "TranslationEventKind" AS ENUM ('FORWARDED', 'SOURCE_CORRECTION');

-- CreateTable
CREATE TABLE "TranslationEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "sourceChannelId" TEXT NOT NULL,
    "targetChannelId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "kind" "TranslationEventKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranslationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranslationEvent_guildId_createdAt_idx" ON "TranslationEvent" ("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "TranslationEvent_guildId_kind_createdAt_idx" ON "TranslationEvent" (
    "guildId",
    "kind",
    "createdAt"
);

-- CreateIndex
CREATE INDEX "TranslationEvent_guildId_targetLanguage_createdAt_idx" ON "TranslationEvent" (
    "guildId",
    "targetLanguage",
    "createdAt"
);