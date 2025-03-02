-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- X検索セッションテーブル
CREATE TABLE IF NOT EXISTS "XSearchSession" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL,
  "messageId" uuid NOT NULL,
  "query" text NOT NULL,
  "modelId" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL,
  "progress" integer DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "XSearchSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "XSearchSession_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE
);

-- X検索結果テーブル（X投稿の一意な保存）
CREATE TABLE IF NOT EXISTS "XSearchResult" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "xPostId" text NOT NULL UNIQUE,  -- X投稿の一意なID
  "content" text NOT NULL,
  "source_title" text,  -- 「Twitter Post by @username」形式のソースタイトル
  "source_url" text,    -- 「https://twitter.com/username/status/id」形式のURL
  "embedding" vector(1536),
  "metadata" jsonb,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- X検索結果とメッセージの中間テーブル
CREATE TABLE IF NOT EXISTS "XSearchResultMessage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "resultId" uuid NOT NULL,
  "sessionId" uuid NOT NULL,
  "messageId" uuid NOT NULL,
  "embeddingScore" real,
  "rerankScore" real,
  "finalScore" real,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "XSearchResultMessage_resultId_fk" FOREIGN KEY ("resultId") REFERENCES "XSearchResult"("id") ON DELETE CASCADE,
  CONSTRAINT "XSearchResultMessage_sessionId_fk" FOREIGN KEY ("sessionId") REFERENCES "XSearchSession"("id") ON DELETE CASCADE,
  CONSTRAINT "XSearchResultMessage_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS "idx_xsearch_session_message" ON "XSearchSession"("messageId");
CREATE INDEX IF NOT EXISTS "idx_xsearch_result_post" ON "XSearchResult"("xPostId");
CREATE INDEX IF NOT EXISTS "idx_xsearch_result_message" ON "XSearchResultMessage"("messageId");
CREATE INDEX IF NOT EXISTS "idx_xsearch_result_scores" ON "XSearchResultMessage"("sessionId", "finalScore" DESC);

-- updatedAtを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_xsearch_session_updated_at
    BEFORE UPDATE ON "XSearchSession"
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER update_xsearch_result_updated_at
    BEFORE UPDATE ON "XSearchResult"
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
