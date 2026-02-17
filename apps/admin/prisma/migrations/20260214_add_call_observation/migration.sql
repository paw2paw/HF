-- Add endedAt to Call for active call tracking
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);

-- CallMessage: stores individual messages during active calls (for live observation)
CREATE TABLE IF NOT EXISTS "CallMessage" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallMessage_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CallMessage_callId_createdAt_idx" ON "CallMessage"("callId", "createdAt");

-- Foreign key
ALTER TABLE "CallMessage" ADD CONSTRAINT "CallMessage_callId_fkey"
    FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;
