# エラーハンドリングユーティリティ

このディレクトリには、Tree of Thoughts（ToT）アプローチで使用するエラーハンドリングユーティリティが含まれています。

## 主な機能

- `handleJsonParseFailure`: JSON解析失敗時の処理
- `reportError`: Sentryへのエラー報告
- `withExponentialBackoff`: 指数バックオフ付き再試行
- `withAIModelBackoff`: AIモデル呼び出し用の再試行
- `initErrorReporting`: エラー報告システムの初期化

## 使用例

### セットアップ

```typescript
// アプリケーション起動時に一度だけ呼び出します
import { initErrorReporting } from "@/lib/mastra/utils/errorHandling";

// .env に SENTRY_DSN を設定しておくと自動的に有効になります
initErrorReporting();
```

### JSON解析エラーのハンドリング

```typescript
import { handleJsonParseFailure } from "@/lib/mastra/utils/errorHandling";

try {
  const parsedData = JSON.parse(responseText);
  // 正常処理...
} catch (parseError) {
  // エラー時のフォールバック処理
  const fallbackResult = handleJsonParseFailure(parseError, responseText, {
    toolName: "exampleTool",
    query: userQuery
  });
  
  // フォールバックロジックの実装
  // ...
}
```

### 指数バックオフを使用したAPI呼び出し

```typescript
import { withAIModelBackoff } from "@/lib/mastra/utils/errorHandling";

// AIモデル呼び出しを指数バックオフで実行
const result = await withAIModelBackoff(() => 
  openaiClient.createCompletion({
    model: "gpt-4-turbo",
    prompt: "長文の複雑なプロンプト...",
    max_tokens: 1000
  })
);

// エラーハンドリングが組み込まれているので、通常の処理を続行できます
console.log(result.text);
```

### エラーの報告

```typescript
import { reportError } from "@/lib/mastra/utils/errorHandling";

try {
  // 処理...
} catch (error) {
  // エラー報告（Sentryに送信されます）
  reportError('custom_operation_error', error, {
    userId: user.id,
    operationName: "データ処理",
    additionalContext: someData
  });
  
  // ユーザーフレンドリーなエラーメッセージを表示
  return {
    success: false,
    message: "処理中にエラーが発生しました。しばらくしてからもう一度お試しください。"
  };
}
```

## 環境変数

- `SENTRY_DSN`: Sentryプロジェクトのデータソース名
- `DISABLE_ERROR_REPORTING`: 「true」に設定するとエラー報告が無効になります（開発環境など）
- `NODE_ENV`: 環境名（development/production）

## その他の注意点

- 全てのツールは `isFallback` フラグを出力スキーマに含め、エラー発生時にはこのフラグを `true` に設定してください
- ビームサーチアルゴリズムは、ノード展開が完全に失敗しても最低限の探索を継続できるようになっています
- テストでは `DISABLE_ERROR_REPORTING=true` を設定してSentryへの送信を無効化してください 