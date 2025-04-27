-- Newsテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS "News" (
  "id" VARCHAR(255) PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source" VARCHAR(255) NOT NULL,
  "url" VARCHAR(255) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "tags" JSONB NOT NULL,
  "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "featured" BOOLEAN DEFAULT FALSE,
  "imageUrl" VARCHAR(255)
);

-- インデックスの作成（検索パフォーマンスの向上）
CREATE INDEX IF NOT EXISTS "news_category_idx" ON "News"("category");
CREATE INDEX IF NOT EXISTS "news_published_at_idx" ON "News"("publishedAt" DESC);

-- updatedAtカラムの追加
ALTER TABLE "News" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- updatedAtを自動更新するトリガー
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_news_timestamp'
  ) THEN
    CREATE TRIGGER update_news_timestamp
      BEFORE UPDATE ON "News"
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp_column();
  END IF;
END $$;
