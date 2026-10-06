-- CreateEnum
CREATE TYPE "SignSource" AS ENUM ('model', 'gesture', 'custom');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sign" (
    "id" UUID NOT NULL,
    "ownerId" UUID,
    "name" TEXT NOT NULL,
    "source" "SignSource" NOT NULL,
    "gestureName" TEXT,
    "stickerUrl" TEXT NOT NULL,
    "emojiUrl" TEXT NOT NULL,
    "confetti" TEXT NOT NULL,
    "colorDark" TEXT NOT NULL,
    "colorLight" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignSample" (
    "id" UUID NOT NULL,
    "signId" UUID NOT NULL,
    "landmarks" BYTEA NOT NULL,
    "handedness" TEXT[],
    "handCount" INTEGER NOT NULL,
    "featureVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Sign_ownerId_createdAt_idx" ON "Sign"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "SignSample_signId_idx" ON "SignSample"("signId");

-- AddForeignKey
ALTER TABLE "Sign" ADD CONSTRAINT "Sign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignSample" ADD CONSTRAINT "SignSample_signId_fkey" FOREIGN KEY ("signId") REFERENCES "Sign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
