# X検索処理フロー詳細説明書

## 概要

このドキュメントでは、X検索（Twitter検索）の処理フローを詳細に説明します。特に、検索結果の保存と関連付けのプロセスに焦点を当てています。

## 処理フロー図

```ascii
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  検索クエリ入力  │────▶│  サブクエリ生成  │────▶│    並列検索     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  結果の表示・    │◀────│  再ランク付け    │◀────│  検索結果の保存  │
│  インタラクション │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## データベースのテーブル構成

検索結果の保存には以下のテーブルが使用されます：

1. **XSearchSession**: 検索セッション情報を管理
2. **XSearchResult**: 検索結果（ツイート）の情報を保存
3. **XSearchResultMessage**: 検索結果とメッセージの関連付け情報

## 詳細な処理ステップ

### 1. 検索クエリ入力とセッション作成

ユーザーが検索クエリを入力すると、以下の処理が行われます：

```typescript
// XSearchSessionテーブルに新しいセッションを作成
const session = {
  id: crypto.randomUUID(),
  messageId: messageId,
  query: query,
  status: 'created',
  progress: 0,
  createdAt: new Date(),
  updatedAt: new Date()
};
```

### 2. サブクエリ生成

入力されたクエリから複数のサブクエリを生成します：

```typescript
// サブクエリの生成と保存
const subQueries = await generateSubQueries(query);
await dbAdapter.saveSubQueries(subQueries, messageId, session.id);
```

### 3. 並列検索の実行

生成されたサブクエリを使用して並列に検索を実行します：

```typescript
// セッションステータスを更新
await supabase
  .from('XSearchSession')
  .update({
    status: 'searching',
    progress: 30,
    updatedAt: new Date().toISOString()
  })
  .eq('id', sessionId);

// 並列検索の実行
const searchResults = await executeParallelSearch(subQueries);
```

### 4. 検索結果の保存 (XSearchResult)

検索結果をXSearchResultテーブルに保存します：

```typescript
// セッションステータスを「saving_results」に更新
await supabase
  .from('XSearchSession')
  .update({
    status: 'saving_results',
    progress: 50,
    updatedAt: new Date().toISOString()
  })
  .eq('id', sessionId);

// 各検索結果をXSearchResultテーブルに保存
for (const result of searchResults) {
  // 既存のレコードを確認
  const { data: existingResult } = await supabase
    .from('XSearchResult')
    .select('id')
    .eq('xPostId', result.id)
    .maybeSingle();
    
  if (existingResult) {
    // 既存のレコードを更新
    await supabase
      .from('XSearchResult')
      .update({
        content: result.content,
        author: result.author,
        createdAt: result.createdAt,
        updatedAt: new Date().toISOString()
      })
      .eq('id', existingResult.id);
  } else {
    // 新しいレコードを作成
    await supabase
      .from('XSearchResult')
      .insert({
        id: crypto.randomUUID(),
        xPostId: result.id,
        content: result.content,
        author: result.author,
        createdAt: result.createdAt,
        updatedAt: new Date().toISOString()
      });
  }
}

// 保存完了後、セッションステータスを「results_saved」に更新
await supabase
  .from('XSearchSession')
  .update({
    status: 'results_saved',
    progress: 70,
    updatedAt: new Date().toISOString()
  })
  .eq('id', sessionId);
```

### 5. 検索結果とメッセージの関連付け (XSearchResultMessage)

XSearchResultMessageテーブルに検索結果とメッセージの関連付け情報を保存します：

```typescript
// セッションステータスが「results_saved」になるのを待機
const resultsReady = await waitForSessionStatus(supabase, sessionId, 'results_saved', 60, 1000);

// 各検索結果に対して処理
for (const result of searchResults) {
  // XSearchResultから結果データを取得
  const { data: resultData } = await supabase
    .from('XSearchResult')
    .select('id')
    .eq('xPostId', result.id)
    .single();
    
  if (!resultData) continue;
    
  // スコア情報を取得
  const embeddingScore = result.embeddingScore || 0;
  const rerankScore = result.rerankScore || null;
  const finalScore = result.finalScore || embeddingScore;
    
  // XSearchResultMessageに登録
  await supabase
    .from('XSearchResultMessage')
    .insert({
      id: crypto.randomUUID(),
      resultId: resultData.id,
      sessionId: sessionId,
      messageId: messageId,
      embeddingScore: embeddingScore,
      rerankScore: rerankScore,
      finalScore: finalScore,
      createdAt: new Date()
    });
}
```

### 6. 検索結果の再ランク付け

検索結果に対して再ランク付けを行います：

```typescript
// セッションステータスを更新
await supabase
  .from('XSearchSession')
  .update({
    status: 'reranking',
    progress: 80,
    updatedAt: new Date().toISOString()
  })
  .eq('id', sessionId);

// 再ランク付けの実行
await rerankSimilarDocuments(messageId);

// 再ランク付け完了後、セッションステータスを更新
await supabase
  .from('XSearchSession')
  .update({
    status: 'completed',
    progress: 100,
    updatedAt: new Date().toISOString()
  })
  .eq('id', sessionId);
```

## セッションステータスの遷移

セッションステータスは以下のように遷移します：

1. **created**: セッション作成直後
2. **searching**: 検索実行中
3. **saving_results**: XSearchResultテーブルへの保存中
4. **results_saved**: XSearchResultテーブルへの保存完了
5. **reranking**: 再ランク付け中
6. **completed**: 全処理完了

## デバッグ方法

### ログの確認

各ステップでは色付きのログが出力されます：

- 緑色（背景）: 成功メッセージ
- 黄色（背景）: 警告、処理中のステータス
- 青色（背景）: 情報メッセージ
- 赤色（背景）: エラーメッセージ

### データベースの確認

以下のSQLクエリを使用して、各テーブルのデータを確認できます：

```sql
-- セッション情報の確認
SELECT * FROM "XSearchSession" WHERE "messageId" = '対象のメッセージID' ORDER BY "createdAt" DESC;

-- 検索結果の確認
SELECT * FROM "XSearchResult" WHERE "xPostId" IN (
  SELECT "xPostId" FROM "XSearchResult" r
  JOIN "XSearchResultMessage" rm ON r.id = rm."resultId"
  WHERE rm."messageId" = '対象のメッセージID'
);

-- 関連付け情報の確認
SELECT * FROM "XSearchResultMessage" WHERE "messageId" = '対象のメッセージID';
```

## エンベディング計算について

検索結果のスコアリングには、Cohereのエンベディングモデルを使用しています：

```typescript
// エンベディング計算
const embeddings = await cohere.embed({
  texts: [query, ...results.map(r => r.content)],
  model: 'embed-english-v3.0'
});

// コサイン類似度の計算
const queryEmbedding = embeddings[0];
const resultEmbeddings = embeddings.slice(1);

for (let i = 0; i < results.length; i++) {
  const similarity = cosineSimilarity(queryEmbedding, resultEmbeddings[i]);
  results[i].embeddingScore = similarity;
}
```

## トラブルシューティング

### XSearchResultMessageにデータが登録されない場合

1. **セッションステータスの確認**:
   - XSearchSessionテーブルのstatusフィールドが「results_saved」になっているか確認
   - ステータスが更新されていない場合、XSearchResultの保存処理に問題がある可能性

2. **XSearchResultの確認**:
   - XSearchResultテーブルに検索結果が正しく保存されているか確認
   - xPostIdが正しく設定されているか確認

3. **エラーログの確認**:
   - コンソールログで「XSearchResultMessage登録エラー」を検索
   - エラーコードと詳細メッセージを確認

4. **ポーリング設定の調整**:
   - waitForSessionStatus関数のmaxAttemptsとintervalMsパラメータを調整
   - 大量のデータを処理する場合は、タイムアウト時間を長くする

## 改善点と今後の課題

1. **パフォーマンスの最適化**:
   - 一括挿入（バルクインサート）の活用
   - トランザクション処理の導入

2. **エラーハンドリングの強化**:
   - リトライメカニズムの導入
   - 部分的な失敗からの回復処理

3. **ステータス管理の改善**:
   - より細かいステータス遷移
   - 進捗率の正確な計算

4. **ユーザーフィードバックの強化**:
   - リアルタイムの進捗表示
   - エラー発生時のユーザーへの通知
