# X検索機能の型システム改善

## 概要
X検索機能の型安全性を向上させるため、型システムの改善を実施。コンポーネント間の型の一貫性を確保し、エラーの早期発見を促進。

## 変更内容 (2025-02-19)

### 1. `lib/ai/x-search/index.ts`
- `XSearchResponse` インターフェースを追加
  ```typescript
  export interface XSearchResponse {
    role: 'assistant';
    content: string;
    xSearchState: XSearchState;
  }
  ```
- `handleXSearch` 関数の戻り値型を明示的に指定
  ```typescript
  export async function handleXSearch(
    message: Message | CreateMessage,
    options: XSearchOptions,
  ): Promise<XSearchResponse>
  ```

### 2. `components/multimodal-input.tsx`
- X検索のレスポンス型を追加
  ```typescript
  interface XSearchResponse {
    xSearchState?: XSearchState;
    [key: string]: any;
  }
  ```
- `handleSubmit` 関数の戻り値型を更新
  ```typescript
  handleSubmit: (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<XSearchResponse | void>;
  ```

### 3. `components/artifact.tsx`
- `XSearchResponse` 型のインポートを追加
- `handleSubmit` 関数の型定義を更新
  ```typescript
  handleSubmit: (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<void | XSearchResponse>;
  ```

### 4. 検索実行ステージの型対応 (2025-02-19)
- 検索実行ステージのレスポンスに`xSearchState`を追加
  ```typescript
  return {
    role: 'assistant',
    content: response,
    xSearchState: {
      stage: 'search_execution',
      subqueries: options.xSearchState.subqueries,
    },
  };
  ```
- 状態の一貫性を維持
  - 検索ステージの情報を保持
  - サブクエリ情報の引き継ぎ

### 5. X検索の実装改善 (2025-02-19)
- `generateCozeResponse`から`executeCozeQueries`への移行
  ```typescript
  // Before
  const response = await generateCozeResponse(
    message.content,
    options,
  );

  // After
  const results = await executeCozeQueries(
    options.xSearchState.subqueries.queries,
    options.id, // userId
    undefined, // chatId
    undefined, // onProgress
  );
  ```
- レスポンス形式の統一
  - 検索結果を適切にJSON形式で返却
  - 状態管理の一貫性を維持

### 6. Coze実装との統合 (2025-02-19)
- `FormattedResponse`型の活用
  ```typescript
  export interface XSearchResponse {
    role: 'assistant';
    content: string;
    xSearchState: XSearchState;
    results?: FormattedResponse[];  // Cozeの型を再利用
  }
  ```
- レスポンス形式の改善
  - サブクエリ生成時：
    ```typescript
    content: `以下のサブクエリを生成しました：\n\n${JSON.stringify(subqueries.queries, null, 2)}\n\n検索を実行するには、実行したいクエリを選択してください。`
    ```
  - 検索実行時：
    ```typescript
    content: `検索結果の概要：\n\n${summary}`
    results: formattedResults  // 詳細なデータは別フィールドに
    ```

### 7. サブクエリの型変換 (2025-02-19)
- サブクエリの型を適切に変換
  ```typescript
  // SubqueryGenerationResult型
  interface SubqueryGenerationResult {
    queries: Array<{ query: string }>;
  }

  // 文字列配列への変換
  const queryStrings = options.xSearchState.subqueries.queries.map(q => q.query);
  
  // Coze APIの呼び出し
  const results = await executeCozeQueries(
    queryStrings,  // string[]型として渡す
    options.id,
    undefined,
    undefined,
  );
  ```

### 8. XSearchOptionsの拡張 (2025-02-19)
- `userId`プロパティの追加
  ```typescript
  export interface XSearchOptions extends ChatRequestOptions {
    isXSearch: boolean;
    xSearchState?: XSearchState;
    userId?: string;  // Coze APIに渡すためのユーザーID
  }
  ```
- `executeCozeQueries`の呼び出し修正
  ```typescript
  const results = await executeCozeQueries(
    queryStrings,
    options.userId,  // userIdを渡す
    undefined,      // chatId
    undefined,      // onProgress
  );
  ```

### 9. サブクエリ生成の改善 (2025-02-19)
- `generateCozeResponse`から`executeCozeQueries`への移行
  ```typescript
  // Before
  const response = await generateCozeResponse(
    SUBQUERY_GENERATION_PROMPT + '\n\n' + userPrompt,
    options,
  );

  // After
  const response = await executeCozeQueries(
    [SUBQUERY_GENERATION_PROMPT + '\n\n' + userPrompt],
    options.userId,
    undefined,  // chatId
  );
  ```

- レスポンスのパース処理を改善
  ```typescript
  // レスポンスから最初の投稿のテキストを取得
  const generatedText = response[0]?.posts[0]?.text || '[]';

  // JSON文字列をパースして配列形式を確認
  const queries = JSON.parse(generatedText);
  if (!Array.isArray(queries)) {
    throw new Error('生成されたクエリが配列ではありません。');
  }
  ```

### 10. 型の統一 (2025-02-19)
- `generateXSearchSubqueries`の型を更新
  ```typescript
  // Before
  function generateXSearchSubqueries(
    userQuery: string,
    options: ChatRequestOptions,  // 基本的な型
  ): Promise<SubqueryGenerationResult>

  // After
  function generateXSearchSubqueries(
    userQuery: string,
    options: XSearchOptions,  // X検索用の拡張型
  ): Promise<SubqueryGenerationResult>
  ```

### 11. インポートと型の修正 (2025-02-19)
- インポートの整理
  ```typescript
  import { executeCozeQueries, type FormattedResponse } from '@/lib/ai/coze/coze';
  ```

- 型の修正
  ```typescript
  export interface XSearchResponse {
    role: 'assistant';
    content: string;
    xSearchState: XSearchState;
    results?: FormattedResponse[];  // any[]から具体的な型へ
  }
  ```

### 関連する改善
- 型安全性の向上
- コードの可読性向上
- インターフェースの一貫性確保

### 今後の課題
- 型の共通化
- インポートの最適化
- 型チェックの強化

### 関連する改善
- 型の整合性確保
- APIインターフェースの統一
- オプショナルパラメータの明確化

### 今後の課題
- ユーザーIDの管理方法の検討
- チャットIDの活用検討
- 進捗通知の実装

### 関連する改善
- 型の再利用性の向上
- ユーザー体験の改善
  - 読みやすいメッセージ形式
  - 段階的な情報提示

### 今後の課題
- メッセージのローカライズ
- 検索結果の表示カスタマイズ
- エラーメッセージの改善

## 改善点
1. 型の明確化
   - 各コンポーネントの型定義を明確に
   - 型の一貫性を確保

2. エラー検出の向上
   - コンパイル時のエラー検出
   - 型の不一致を早期に発見

3. コードの保守性
   - 型定義の集中管理
   - 再利用可能な型の提供

## 今後の課題
1. エラーケースの型定義
   - エラー状態の明確な型付け
   - エラーハンドリングの型安全性向上

2. 型の再利用性
   - 共通の型定義の整理
   - 型の抽象化レベルの最適化

3. 型の文書化
   - 型定義の詳細なドキュメント
   - 使用例の提供

## 関連コンポーネント
- MultimodalInput
- Artifact
- X Search System

## 技術スタック
- TypeScript
- React
- Next.js
