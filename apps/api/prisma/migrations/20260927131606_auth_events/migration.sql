-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('login', 'login_failed', 'logout', 'username_set');

-- CreateTable
CREATE TABLE "AuthEvent" (
    "id" UUID NOT NULL,
    "type" "AuthEventType" NOT NULL,
    "userId" UUID,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthEvent_userId_createdAt_idx" ON "AuthEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_type_createdAt_idx" ON "AuthEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
