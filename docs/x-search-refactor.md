# X検索機能のリファクタリング

## 2025-02-19の修正内容

### 問題点
1. X検索のレスポンスがストリーミングされていなかった
2. `route.ts`と`x-search/index.ts`で重複した処理が存在
3. TypeScriptの型エラーが発生

### 修正内容

#### 1. `app/(chat)/api/chat/route.ts`の修正
- X検索のストリーミング処理を追加
- Vercel AI SDKの`createDataStreamResponse`を使用
- システムプロンプトを追加

```typescript
// X検索が有効な場合は、X検索のフローを実行
if (options?.isXSearch) {
  const xSearchResult = await handleXSearch(messages[messages.length - 1], options);
  
  // ストリーミングレスポンスを作成
  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: myProvider.languageModel('chat-model-small'),
        system: X_SEARCH_SYSTEM_PROMPT,
        messages: [{
          role: 'assistant',
          content: xSearchResult.content,
        }],
        experimental_transform: smoothStream({ chunking: 'word' }),
        onFinish: async () => {
          console.log('X search response finished', {
            timestamp: new Date().toISOString(),
            xSearchState: xSearchResult.xSearchState
          });
        },
      });
      
      // streamTextの結果をデータストリームにマージ
      result.mergeIntoDataStream(dataStream);
    },
    onError: () => {
      return 'X検索の実行中にエラーが発生しました。もう一度お試しください。';
    },
  });
}
```

#### 2. `lib/ai/x-search/index.ts`の修正
- レスポンスの型を`Response`から`XSearchResponse`に戻す
- ストリーミング処理を`route.ts`に移動

```typescript
export interface XSearchResponse {
  role: 'assistant';
  content: string;
  id: string;
  createdAt?: Date;
  xSearchState?: XSearchState;
}

export async function handleXSearch(
  message: Message | CreateMessage,
  options: XSearchOptions,
): Promise<XSearchResponse> {
  // ...
}
```

### システムプロンプトの追加
```typescript
const X_SEARCH_SYSTEM_PROMPT = `
あなたは「GPT-4レベルのAI」であり、「PitattoAI」のX検索アシスタントです。
ユーザーの入力から、X(Twitter)検索に適したサブクエリを生成する必要があるかどうかを判断し、適切な応答を返してください。

【判断基準】
1. ユーザーの入力が「X検索に適している」場合：
   - 具体的な情報収集が必要な質問
   - 最新のトレンドや動向に関する質問
   - 特定のトピックに関する実際の意見や反応を知りたい質問
   → サブクエリ生成を提案する

2. ユーザーの入力が「X検索に適していない」場合：
   - 一般的な質問や相談
   - 技術的な説明を求める質問
   - 個人的なアドバイスを求める質問
   → 通常の回答を生成する

【応答形式】
- X検索が適している場合：
  "X検索を実行することで、より具体的な情報が得られそうです。サブクエリを生成してX検索を実行しますか？"

- X検索が適していない場合：
  通常の回答を生成する
`;
```

### 改善点
1. ストリーミング処理の一元化
   - すべてのストリーミング処理を`route.ts`で管理
   - 一貫した実装方法を使用

2. 型の整理
   - `XSearchResponse`型の再導入
   - TypeScriptの型エラーを解消

3. エラーハンドリングの改善
   - ストリーミング中のエラーをキャッチ
   - ユーザーフレンドリーなエラーメッセージを表示

### 今後の課題
1. X検索の結果表示の最適化
2. エラー時のリカバリー処理の強化
3. ストリーミングパフォーマンスの改善
