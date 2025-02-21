# Coze実装の変更履歴

## 2025-02-19
### [lib/ai/coze/coze.ts]
- Cozeパーサーの初期実装
  - `lib/ai/coze`ディレクトリを作成
  - 出力パース用の基本構造を実装

#### 基本設定と定数
- `WORKFLOW_ID`と`API_URL`の設定
- バッチ処理とリトライの最適化
  - `BATCH_SIZE`: 10（処理効率向上のため5から増加）
  - `RETRY_DELAY`: 3000ms（5秒から短縮）
  - `MAX_RETRIES`: 2回
  - `BATCH_DELAY`: 5000ms（8秒から短縮）

#### レート制限の実装
- 1分あたりの最大リクエスト数: 30
- クォータリセット間隔: 60秒
- リクエストカウントの追跡と管理機能

#### データ型定義
1. **TwitterPost インターフェース**
   - 投稿の基本情報（ID、テキスト、作成日時）
   - 作者情報（ID、ユーザー名、プロフィール画像など）
   - メトリクス（リツイート数、返信数、いいね数など）
   - メディア情報（画像、動画、GIF）
   - 参照ツイート情報
   - コンテキストアノテーション

2. **FormattedResponse インターフェース**
   - クエリ情報
   - 投稿リスト
   - メタデータ（総数、ID範囲、処理時間）
   - エラー情報

#### 主要機能
1. **データ処理**
   - `formatTwitterPost`: 生データをTwitterPost型に変換
   - `parseStreamContent`: ストリームコンテンツのパース
   - `processStreamResponse`: レスポンスの処理と整形

2. **Embedding処理**
   - Cohere多言語Embeddingの利用
   - `getEmbeddings`: テキストの1024次元Embedding取得
   - `calculateCosineSimilarity`: コサイン類似度計算
   - `rankByEmbeddingSimilarity`: Embeddingベースのランキング

3. **データ永続化**
   - Supabaseとの連携
   - `storeDataWithEmbedding`: Embedding付きデータの保存
   - `updateRankingsForParentQuery`: ランキングの更新

4. **クエリ実行**
   - `executeCozeQueries`: 複数クエリの並列実行
   - 進捗コールバックのサポート
   - バッチ処理による効率化

5. **再ランキング機能**
   - `RERANK_BATCH_SIZE`: 100（Cohere API制限に基づく）
   - `rerankSimilarDocuments`: Cohereを使用した再ランキング
   - `Rag`インターフェースによるランキングデータの型定義

### 実装の目的
- X検索結果の効率的な取得と処理
- データの構造化と永続化
- 高精度な検索結果のランキング
- API制限の適切な管理

### 今後の課題
1. エラーハンドリングの強化
   - ネットワークエラーの対応
   - API制限到達時の適切な処理

2. パフォーマンス最適化
   - バッチサイズの動的調整
   - キャッシュ戦略の検討

3. 機能拡張
   - より詳細なメタデータの活用
   - 検索結果のフィルタリング機能
   - ユーザーフィードバックの反映

4. テスト整備
   - ユニットテストの作成
   - 統合テストの実装
   - エッジケースの検証

## 実装予定の機能
1. 検索結果の品質向上
   - コンテキストベースのフィルタリング
   - 重複検出の改善
   - 関連度スコアの精緻化

2. システム安定性の向上
   - 障害復旧メカニズムの強化
   - モニタリング機能の追加
   - ログ機能の拡充

3. ユーザー体験の改善
   - 検索進捗の可視化
   - インタラクティブなフィードバック
   - カスタマイズ可能なランキング基準

### 実装の目的
- X検索用のクエリ生成結果をパース
- 構造化されたデータとして扱えるように変換
- 型安全な実装の提供

### 今後の課題
- パースロジックの実装
- エラーハンドリングの追加
- テストケースの作成
- 他の機能でも再利用可能な設計への改善

## 実装予定の機能
1. 基本パース機能
   - JSON形式の出力解析
   - エラー時の適切なフォールバック
   - バリデーション

2. 型定義
   ```typescript
   interface CozeResponse {
     success: boolean;
     data?: any;
     error?: string;
   }
   ```

3. ユーティリティ関数
   - 出力の正規化
   - エラーメッセージの標準化
   - デバッグ用ログ機能

## 2025-02-19
### [lib/ai/coze/coze.ts]
- データ構造をXSearchSession対応に変更
  - `executeCozeQueries`の引数を修正
    - `parentQueryId`を`chatId`に変更
    - 新しいデータベース構造（XSearchSession）に対応
  - 関連する関数の引数も同様に修正
    - `processStreamResponse`
    - `storeDataWithEmbedding`
  - XSearchSessionテーブルへの保存処理を追加
    - セッション作成時のステータス管理
    - 進捗状況の追跡

### 変更詳細
```typescript
// Before
executeCozeQueries(
  subQueries: string[],
  userId?: string,
  parentQueryId?: string,
  onProgress?: (processed: number) => void
)

// After
executeCozeQueries(
  subQueries: string[],
  userId?: string,
  chatId?: string,
  onProgress?: (processed: number) => void
)
```

### 今後の課題
- XSearchResultテーブルの対応
- XSearchResultMessageテーブルの対応
- embeddingのベクトルサイズ調整（1024→1536）

## 2025-02-19
### [lib/ai/coze/coze.ts]
#### storeDataWithEmbedding関数の修正
- 新しいテーブル構造への対応
  - `XSearchResult`テーブルへの投稿データ保存
    - `upsert`を使用して重複を防止
    - `xPostId`をユニークキーとして使用
  - `XSearchResultMessage`テーブルへの中間データ保存
    - embeddingScore、rerankScore、finalScoreの管理
    - セッションIDとメッセージIDの関連付け
  - `XSearchSession`の進捗管理
    - embedding処理完了時に50%に更新

### 変更詳細
```typescript
// データ保存フロー
1. XSearchSessionの取得
2. Embeddingの生成とコサイン類似度の計算
3. XSearchResultへの投稿データ保存（upsert）
4. XSearchResultMessageへの中間データ保存
5. セッション進捗の更新
```

### 今後の課題
- rerankSimilarDocumentsの修正
  - XSearchResultMessageテーブルのrerankScore更新
  - finalScoreの計算ロジック実装

## 2025-02-19
### [lib/ai/coze/coze.ts]
#### rerankSimilarDocuments関数の修正
- 新しいテーブル構造への対応
  - `XSearchSession`からのセッション情報取得
  - `XSearchResultMessage`と`XSearchResult`の結合クエリ
  - スコアの計算と更新
    - embeddingScore: 既存のスコア
    - rerankScore: Cohereのrerank APIの結果
    - finalScore: 重み付け平均（embedding: 0.3, rerank: 0.7）
  - セッションステータスの更新
    - 処理完了時に進捗100%とstatus: 'completed'に設定

### 変更詳細
```typescript
// スコア計算ロジック
const finalScore = (embeddingScore * 0.3 + rerankScore * 0.7);

// データフロー
1. XSearchSessionの取得
2. XSearchResultMessageとXSearchResultの結合クエリ
3. バッチ処理でrerank APIを呼び出し
4. スコアの計算と更新
5. セッションステータスの更新
```

### 今後の課題
- エラー時のセッションステータス更新
- スコアの重み付けの最適化
- バッチサイズの調整

## 2025-02-19 19:55
### [lib/ai/coze/coze.ts]
#### rerankSimilarDocuments関数の修正（既存機能を保持しながら新機能を追加）
- 既存の機能を完全に保持
  - `queries`、`fetched_data`、`rags`テーブルへの保存
  - レート制限チェック
  - バッチ処理（RERANK_BATCH_SIZE = 100）
  - エラーハンドリング

- 新しいテーブル構造のサポート追加
  ```typescript
  // 新旧形式の判定
  const { data: session, error: sessionError } = await supabase
    .from('XSearchSession')
    .select('*')
    .eq('messageId', parentQueryId)
    .single();

  const isNewFormat = !sessionError && session;
  ```

- データの二重保存による安全な移行
  1. 従来のテーブル構造
     - `rags`テーブルへの保存
     - スコアによる降順ソート
     - ランク付け（1から開始）

  2. 新しいテーブル構造（isNewFormat時のみ）
     - `XSearchResult`へのupsert
     ```typescript
     .upsert({
       xPostId: doc.id,
       content: doc.content,
       metadata: doc.metadata,
       updatedAt: new Date().toISOString()
     }, {
       onConflict: 'xPostId'
     })
     ```
     - `XSearchResultMessage`へのupsert
     ```typescript
     .upsert({
       resultId: xSearchResult.id,
       sessionId: session.id,
       messageId: parentQueryId,
       rerankScore: result.relevance_score,
       finalScore: result.relevance_score * 0.7 + (doc.similarity_score || 0) * 0.3
     }, {
       onConflict: 'resultId,sessionId'
     })
     ```

- セッション管理の改善
  - 新形式の場合のみセッション更新
  ```typescript
  if (isNewFormat && session) {
    await supabase
      .from('XSearchSession')
      .update({
        progress: 100,
        status: 'completed',
        updatedAt: new Date().toISOString()
      })
      .eq('id', session.id);
  }
  ```

### 技術的な詳細
1. **スコアの計算方法**
   - embeddingScore（類似度）: 30%
   - rerankScore（関連度）: 70%
   - finalScore = embeddingScore * 0.3 + rerankScore * 0.7

2. **エラーハンドリング**
   - 各ステップでのエラーチェック
   - バッチ処理の継続性確保
   - エラーログの詳細化

3. **パフォーマンス考慮**
   - バッチサイズの最適化（100件）
   - レート制限の考慮
   - upsertによる重複防止

### 今後の課題
1. 移行期間中のモニタリング
   - 両方のテーブルへの保存が正常に行われているか
   - パフォーマンスへの影響

2. 最適化の検討
   - スコアの重み付けの調整
   - バッチサイズの最適化
   - エラーリトライの実装

3. 古いテーブル構造の段階的な廃止計画
   - 移行完了後の手順
   - データの整合性確認方法

## 2025-02-19 20:07
### [lib/ai/coze/coze.ts]
- 古いテーブル構造の参照を完全に削除
  - `Rag`型定義を削除し、新しいテーブル構造の型定義を追加
    - `XSearchSession`
    - `XSearchResult`
    - `XSearchResultMessage`
  - `queries`テーブルへの参照を削除し、`XSearchSession`を使用するように更新
  - `fetched_data`テーブルへの参照を削除

#### 関数の更新
1. **getCurrentQueryId**
   ```typescript
   export async function getCurrentQueryId(searchQuery: string, userId: string): Promise<string | null> {
     // XSearchSessionから最新のセッションを取得
     const { data: session, error: sessionError } = await supabase
       .from('XSearchSession')
       .select('*')
       .eq('userId', userId)
       .eq('query', searchQuery)
       .order('createdAt', { ascending: false })
       .limit(1)
       .single();
   }
   ```

2. **updateRankingsForParentQuery**
   - 古い`queries`と`fetched_data`テーブルの参照を削除
   - 新しい`XSearchSession`と`XSearchResultMessage`テーブルを使用
   - Embeddingスコアの計算と更新ロジックを改善

3. **rerankSimilarDocuments**
   - 古い`rags`テーブルへの保存を削除
   - 新しいテーブル構造に完全移行
   - エラーハンドリングとログ出力を改善

#### 改善点
- エラーメッセージの日本語化による可読性向上
- 型安全性の強化
- データ整合性の向上
- パフォーマンスの最適化

#### 今後の課題
1. 新しいテーブル構造での性能モニタリング
2. エラーハンドリングの継続的な改善
3. ログ出力の最適化
4. 型定義の継続的なメンテナンス

## 2025-02-19 20:13
### [lib/ai/coze/coze.ts]
#### 型安全性の改善
- `rerankSimilarDocuments`関数内の型定義を強化
  - Supabaseクエリ結果の型を明示的に定義
  - バッチ処理での型安全性を向上

1. **型ガードの追加**
   ```typescript
   const validDocuments = results.filter((r): r is XSearchResultMessage & { 
     XSearchResult: Pick<XSearchResult, 'id' | 'content'> 
   } => r.XSearchResult?.content != null);
   ```

2. **map関数のパラメーター型指定**
   ```typescript
   const documents = batch.map((r: XSearchResultMessage & { 
     XSearchResult: Pick<XSearchResult, 'id' | 'content'> 
   }) => r.XSearchResult.content);
   ```

#### 改善点
- 型チェックエラーの解消
- nullチェックの明示化
- コードの意図の明確化
- 実行時の型安全性向上

#### 技術的な詳細
- `Pick<T, K>`型を使用して必要なプロパティのみを選択
- 型ガードによる実行時の型チェック強化
- 交差型（Intersection Type）による型の組み合わせ

#### 今後の展望
1. 他の関数での型安全性の見直し
2. 共通の型定義の整理
3. エラーハンドリングの継続的な改善

## 2025-02-19 20:14
### [lib/ai/coze/coze.ts]
#### Embeddingスコアフィルタリングの復元
- `rerankSimilarDocuments`関数のクエリ条件を更新
  - `embeddingScore >= 0.5`の条件を復元
  - 高スコアのデータのみを再ランク付け対象に

```typescript
.from('XSearchResultMessage')
.select(`
  id,
  resultId,
  XSearchResult (
    id,
    content
  )
`)
.eq('sessionId', session.id)
.gte('embeddingScore', 0.5)  // embeddingScore >= 0.5のデータのみを取得
.order('embeddingScore', { ascending: false })
.limit(RERANK_BATCH_SIZE)
```

#### 変更理由
- 類似度の高いデータのみを再ランク付けの対象とする
- 処理効率の向上
- 結果の品質維持

#### 技術的な詳細
- Supabaseの`.gte()`メソッドを使用
- 降順ソートと組み合わせて最適な結果を取得
- バッチサイズ制限との併用で効率的な処理を実現

#### 影響範囲
1. 再ランク付け対象データの絞り込み
2. 処理パフォーマンスの向上
3. 結果の関連性の向上

## 2025-02-19 20:24
### [lib/ai/coze/coze.ts]
#### 最終スコア計算の実装
- `calculateFinalScore`関数を追加
  - Rerankスコアと初回Embeddingスコアを組み合わせて最終スコアを計算
  - 重み付け: Rerankスコア(0.8) + Embeddingスコア(0.2)

```typescript
function calculateFinalScore(rerankScore: number, embeddingScore: number): number {
  return (rerankScore * 0.8) + (embeddingScore * 0.2);
}
```

#### 実装の特徴
1. **スコアの組み合わせ**
   - Rerankスコア: クエリとの直接的な関連性（重み0.8）
   - Embeddingスコア: 広い文脈での類似性（重み0.2）

2. **データフロー**
   - XSearchResult: Twitter投稿のキャッシュ（Embedding付き）
   - XSearchResultMessage: 検索結果のスコアリング管理
   - XSearchSession: 検索セッション全体の管理

3. **処理の流れ**
   - 初期Embeddingスコアでフィルタリング（>= 0.5）
   - Rerankによる詳細な関連性評価
   - 両スコアを組み合わせて最終順位を決定

#### 今後の検討事項
1. スコアの重み付け調整
   - ユースケースに応じた最適化
   - A/Bテストの検討

2. パフォーマンス最適化
   - バッチサイズの調整
   - キャッシュ戦略の改善

3. モニタリング
   - 処理時間の計測
   - スコア分布の分析
   - エラーレートの監視

## 2025-02-19 20:26
### X検索の全体フロー解説

#### 1. 検索プロセスの開始
- ユーザーがクエリを入力
- XSearchSessionの作成と初期化
  ```typescript
  {
    userId: string,
    messageId: string,
    query: string,
    status: 'pending'
  }
  ```

#### 2. データ取得と初期保存
- Cozeワークフローを使用してTwitterデータを取得
- 取得したデータの永続化:
  ```typescript
  // XSearchResult（キャッシュ）
  {
    xPostId: string,        // Twitter投稿ID
    content: string,        // 投稿内容
    embedding: number[],    // Cohereで生成した埋め込み
    metadata: any          // 投稿の詳細情報
  }

  // XSearchResultMessage（中間データ）
  {
    embeddingScore: number,  // 初期類似度
    rerankScore: null,      // 初期はnull
    finalScore: number      // 初期は embeddingScore
  }
  ```

#### 3. Rerank処理
1. **データ取得**
   - embeddingScore >= 0.5 のデータを選択
   - 100件ずつバッチ処理

2. **再評価**
   ```typescript
   // Cohere rerank API
   {
     model: 'rerank-multilingual-v3.0',
     query: session.query,
     documents: string[],
     top_n: documents.length
   }
   ```

3. **スコア計算**
   ```typescript
   finalScore = (rerankScore * 0.8) + (embeddingScore * 0.2)
   ```

4. **結果の更新**
   - XSearchResultMessageの更新
   - セッションのステータス更新

#### 4. 最適化とパフォーマンス
1. **バッチ処理**
   - RERANK_BATCH_SIZE = 100
   - API負荷の分散
   - レート制限への対応

2. **フィルタリング**
   - embeddingScore >= 0.5
   - 関連性の低いデータを早期除外

3. **スコアリング**
   - Rerankスコア（重み: 0.8）
     - クエリとの直接的な関連性
     - より詳細な類似性評価
   - Embeddingスコア（重み: 0.2）
     - 広い文脈での類似性
     - 初期フィルタリングの基準

#### 5. エラーハンドリング
- API呼び出しの例外処理
- トランザクション管理
- セッション状態の適切な更新
- エラーログの記録

#### 6. 今後の改善点
1. スコアの重み付け調整
   - ユースケースに応じた最適化
   - A/Bテストの検討

2. パフォーマンス最適化
   - バッチサイズの調整
   - キャッシュ戦略の改善

3. モニタリング
   - 処理時間の計測
   - スコア分布の分析
   - エラーレートの監視
