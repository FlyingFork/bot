-- CreateTable
CREATE TABLE "ForwardedMessage" (
    "id" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "sourceChannelId" TEXT NOT NULL,
    "targetChannelId" TEXT NOT NULL,
    "webhookMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForwardedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForwardedMessage_sourceMessageId_idx" ON "ForwardedMessage"("sourceMessageId");
