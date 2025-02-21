# X検索機能の実装仕様

## 1. 概要
チャットインターフェースにX（旧Twitter）の検索機能を実装し、ユーザーの入力から適切な検索クエリを生成し、関連情報を収集・分析して最適な回答を提供する機能。

## 2. 処理フロー

### 2.1 検索クエリの生成と実行
1. ユーザーが入力したテキストを受け取る
2. ChatGPTを使用して検索クエリを生成
   - `multimodal-input.tsx`で選択されているAIモデルを使用して検索意図を予測
   - 最低6つの異なる検索クエリを生成
3. 生成されたクエリでX検索を実行
   - 各クエリでX検索を実行
   - 各クエリごとに最大100件の情報を取得

### 2.2 データストレージ戦略

#### A. データモデル
```sql
-- X検索セッションテーブル
CREATE TABLE IF NOT EXISTS "XSearchSession" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL,
  "messageId" text NOT NULL,
  "query" text NOT NULL,
  "modelId" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL,
  "progress" integer DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "XSearchSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- X検索結果テーブル（X投稿の一意な保存）
CREATE TABLE IF NOT EXISTS "XSearchResult" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "xPostId" text NOT NULL UNIQUE,  -- X投稿の一意なID
  "content" text NOT NULL,
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
  "messageId" text NOT NULL,
  "embeddingScore" real,
  "rerankScore" real,
  "finalScore" real,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "XSearchResultMessage_resultId_fk" FOREIGN KEY ("resultId") REFERENCES "XSearchResult"("id") ON DELETE CASCADE,
  CONSTRAINT "XSearchResultMessage_sessionId_fk" FOREIGN KEY ("sessionId") REFERENCES "XSearchSession"("id") ON DELETE CASCADE
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
```

#### B. データアクセスパターン
```typescript
// X投稿の保存（重複を避ける）
async function saveXPost(post: XPost) {
  const existing = await db
    .select()
    .from("XSearchResult")
    .where({ xPostId: post.id })
    .first();

  if (existing) {
    return existing;
  }

  return await db
    .insert("XSearchResult")
    .values({
      xPostId: post.id,
      content: post.content,
      embedding: post.embedding,
      metadata: post.metadata
    })
    .returning("*")
    .first();
}

// メッセージとの紐付け
async function linkPostToMessage(
  result: XSearchResult,
  session: SearchSession,
  scores: SearchScores
) {
  await db
    .insert("XSearchResultMessage")
    .values({
      resultId: result.id,
      sessionId: session.id,
      messageId: session.messageId,
      embeddingScore: scores.embedding,
      rerankScore: scores.rerank,
      finalScore: scores.final
    });
}

// メッセージごとの検索結果取得
async function getSearchResultsForMessage(messageId: string) {
  return await db
    .select([
      "XSearchResult.*",
      "XSearchResultMessage.embeddingScore",
      "XSearchResultMessage.rerankScore",
      "XSearchResultMessage.finalScore"
    ])
    .from("XSearchResultMessage")
    .join(
      "XSearchResult",
      "XSearchResult.id",
      "XSearchResultMessage.resultId"
    )
    .where({
      "XSearchResultMessage.messageId": messageId
    })
    .orderBy("XSearchResultMessage.finalScore", "desc");
}
```

### 2.3 進捗管理と状態表示

#### A. 検索フェーズ
```typescript
type SearchPhase = 
  | 'QUERY_GENERATION'  // クエリの生成中
  | 'SEARCHING'         // X検索の実行中
  | 'EMBEDDING'         // Embedding生成中
  | 'RANKING'           // 結果のランキング中
  | 'RERANKING'         // 結果の再ランキング中
  | 'SAVING';           // 結果の保存中

// フェーズごとの進捗重み
const PHASE_WEIGHTS: Record<SearchPhase, number> = {
  QUERY_GENERATION: 0.1,
  SEARCHING: 0.3,
  EMBEDDING: 0.2,
  RANKING: 0.15,
  RERANKING: 0.15,
  SAVING: 0.1
};
```

#### B. 進捗追跡
```typescript
class SearchProgressTracker {
  private startTime: number;
  private phaseStartTimes: Map<SearchPhase, number>;
  
  constructor(private sessionId: string) {
    this.startTime = Date.now();
    this.phaseStartTimes = new Map();
  }
  
  async updatePhase(phase: SearchPhase) {
    this.phaseStartTimes.set(phase, Date.now());
    const estimatedTimeLeft = this.calculateEstimatedTime(phase);
    await this.notifyClients({
      type: 'phase',
      phase,
      estimatedTimeLeft
    });
  }
  
  async updateProgress(phase: SearchPhase, progress: number) {
    const totalProgress = calculateTotalProgress(phase, progress);
    await this.notifyClients({
      type: 'progress',
      progress: totalProgress,
      phase
    });
  }
}
```

## 3. エラーハンドリング

### 3.1 エラーリカバリー
1. チェックポイント機能
2. 部分的な結果の保持
3. 処理状態の復元

### 3.2 エッジケース対応
1. 長時間の切断
   - セッションのTTL設定
   - 部分的な結果の保持
   - 再開ポイントの記録

2. 複数タブでの開封
   - セッション共有の制御
   - 更新の同期
   - 競合の解決

## 4. パフォーマンス最適化

### 4.1 バッチ処理
```typescript
class ResultBatcher {
  private buffer: SearchResult[] = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(private readonly batchSize: number = 10) {}
  
  add(result: SearchResult) {
    this.buffer.push(result);
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 1000);
    }
  }
  
  private async flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    this.timer = null;
    await this.processBatch(batch);
  }
}
```

## 5. 使用技術
- Coze: ノーコードツールによるX検索クエリ生成
- Redis: セッション管理、キャッシュ（Upstash推奨）
- Supabase: 永続化ストレージ、認証、リアルタイム更新
- WebSocket: リアルタイム通信
- Bull: ジョブキュー
- Cohere: Embedding生成

### 5.1 データ永続化戦略
1. X投稿の重複排除
   - xPostIdによる一意性の保証
   - 既存投稿の再利用
   - ストレージの効率化

2. スコアの管理
   - 初期埋め込みスコア
   - 再ランキングスコア
   - 最終スコアの計算と更新

3. メッセージとの関連付け
   - 中間テーブルによる柔軟な紐付け
   - 複数メッセージでの再利用
   - スコアの独立した管理
