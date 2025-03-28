-- Videoテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS "Video" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "tags" TEXT,
  "fileName" VARCHAR,
  "fileUrl" VARCHAR,
  "fileSize" VARCHAR,
  "mimeType" VARCHAR,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on userId for faster queries
CREATE INDEX IF NOT EXISTS "video_user_id_idx" ON "Video"("userId");

-- fileName列のNOT NULL制約を削除（既に存在する場合）
ALTER TABLE "Video" ALTER COLUMN "fileName" DROP NOT NULL;
