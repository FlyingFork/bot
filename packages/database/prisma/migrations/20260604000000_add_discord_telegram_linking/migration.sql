-- AlterTable
ALTER TABLE "user" ADD COLUMN "discord_id" TEXT;
ALTER TABLE "user" ADD COLUMN "discord_username" TEXT;
ALTER TABLE "user" ADD COLUMN "telegram_id" TEXT;
ALTER TABLE "user" ADD COLUMN "telegram_username" TEXT;

-- CreateTable
CREATE TABLE "link_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "link_tokens_token_key" ON "link_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_discord_id_key" ON "user"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_telegram_id_key" ON "user"("telegram_id");

-- AddForeignKey
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
