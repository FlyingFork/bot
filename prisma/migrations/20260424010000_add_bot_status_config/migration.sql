CREATE TABLE "bot_status_config" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "activityType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "countdownTargetAt" TIMESTAMP(3),
    "languageCodesJson" TEXT NOT NULL DEFAULT '[]',
    "translationIntervalSeconds" INTEGER NOT NULL DEFAULT 15,
    "currentLanguageIndex" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bot_status_config_pkey" PRIMARY KEY ("id")
);