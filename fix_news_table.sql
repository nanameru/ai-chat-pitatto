-- Newsテーブルのタイムスタンプカラムをタイムゾーン対応に修正
ALTER TABLE "News" 
  ALTER COLUMN "publishedAt" TYPE TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE; 