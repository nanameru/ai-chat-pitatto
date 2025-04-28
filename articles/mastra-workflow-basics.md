---
title: "Mastra Workflow の基本的な使い方：処理フローを自動化"
emoji: "🚀"
type: "tech"
topics: ["Mastra", "Workflow", "Automation", "TypeScript"]
published: false
---

# Mastra Workflow の基本的な使い方：処理フローを自動化

Mastra の **Workflow** 機能を使うと、複数の処理ステップを組み合わせた自動化フローを簡単に構築できます。API 呼び出し、データ処理、条件分岐などを組み合わせ、複雑なタスクもコードで明確に定義できます。

本記事では、Mastra Workflow の中心となる `Workflow` クラスと `Step` クラスの基本的な使い方を解説します。

> 公式ドキュメント: [Workflow Overview](https://mastra.ai/ja/docs/workflows/overview)

---

## 1. Workflow とは？ Step とは？

*   **Workflow**: 一連の処理全体の設計図です。名前やトリガー条件などを定義します。
*   **Step**: Workflow を構成する個々の処理単位です。ID、説明、入力/出力、実行ロジックを持ちます。

料理に例えると、Workflow は「カレーを作る」というレシピ全体、Step は「野菜を切る」「肉を炒める」「煮込む」といった個々の工程にあたります。

---

## 2. Workflow を定義する

まず、`Workflow` クラスを使ってワークフロー全体を定義します。

```ts
import { Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { mastra } from '../mastra'; // Mastra のインスタンスをインポート

// ワークフローの定義
export const basicWorkflow = new Workflow({
  name: 'basic-sample-workflow', // ワークフローの一意な名前
  // ワークフローを起動する際の入力データ型を Zod で定義
  triggerSchema: z.object({
    userName: z.string().describe('ユーザー名'),
  }),
  mastra, // Mastra インスタンスを渡す
});
```

*   `name`: ワークフローを識別するためのユニークな名前です。
*   `triggerSchema`: このワークフローを開始するときに必要な入力データの型を `zod` で定義します。型安全性が高まります。
*   `mastra`: 設定済みの Mastra インスタンスを渡します。

---

## 3. Step を定義する

次に、個々の処理単位である `Step` を定義します。

```ts
import { Step } from '@mastra/core/workflows';
import { z } from 'zod';

// 最初のステップ：挨拶を生成する
const createGreetingStep = new Step({
  id: 'create-greeting', // ステップの一意な ID
  description: 'ユーザー名から挨拶文を作成する',
  // このステップが受け取る入力データの型
  inputSchema: z.object({
    userName: z.string(),
  }),
  // このステップが出力するデータの型
  outputSchema: z.object({
    greeting: z.string(),
  }),
  // 実際の処理ロジック
  execute: async ({ context }) => {
    // context.input で入力データを参照できる
    const message = `こんにちは、${context.input.userName}さん！`;
    return { greeting: message }; // outputSchema に沿ったデータを返す
  },
});

// 次のステップ：挨拶を表示する
const displayGreetingStep = new Step({
  id: 'display-greeting',
  description: '生成された挨拶を表示する',
  inputSchema: z.object({
    greeting: z.string(), // 前のステップの出力
  }),
  outputSchema: z.object({ // 何も返さない場合は空オブジェクトなど
    status: z.string(),
  }),
  execute: async ({ context }) => {
    console.log('実行結果:', context.input.greeting);
    return { status: '表示完了' };
  },
});
```

*   `id`: ステップを識別するためのユニークな ID。
*   `description`: ステップの目的を説明します。
*   `inputSchema`: このステップが期待する入力データの型。
*   `outputSchema`: このステップが返すデータの型。
*   `execute`: ステップの実際の処理を記述する非同期関数。`context.input` で入力を受け取り、`outputSchema` に一致するオブジェクトを返します。

---

## 4. Workflow に Step を組み込む

定義した Step を Workflow に組み込み、実行順序を定義します。

```ts
basicWorkflow
  .step(createGreetingStep) // 最初のステップを登録
  .then(displayGreetingStep) // createGreetingStep の後に displayGreetingStep を実行
  .commit(); // ワークフローの定義を確定
```

*   `.step()`: ワークフローの開始点となるステップを登録します。
*   `.then()`: 前のステップが成功した場合に次に実行するステップを指定します。前のステップの出力が次のステップの入力として自動的に渡されます（input/outputSchema が一致する場合）。
*   `.commit()`: ワークフローの定義を最終的に確定します。これを呼び出すまでワークフローは有効になりません。

---

## 5. Workflow を実行する

定義したワークフローは、例えば API ルートなどから以下のように実行できます。

```ts
// API ルートなどで...
import { basicWorkflow } from '../workflows/basic'; // 定義したワークフローをインポート

// ...
const run = basicWorkflow.createRun({
  triggerData: { userName: '山田' }, // triggerSchema に基づく入力
});

// 実行を開始し、結果を待つ
const result = await run.start();

console.log('ワークフロー実行結果:', result);
// result.results['display-greeting']?.output?.status などで各ステップの結果にアクセス可能
```

*   `createRun()`: `triggerData` を渡してワークフローの実行インスタンスを作成します。
*   `start()`: ワークフローの実行を開始し、完了するまで待機します。

---

## まとめ

Mastra Workflow を使うことで、
1.  `Workflow` で全体の流れを定義し、
2.  `Step` で個々の処理を実装し、
3.  `.step().then().commit()` でそれらを繋ぎ合わせる
という手順で、自動化フローを構築できます。

`zod` による型定義で安全性も高く、複雑な処理も構造化して記述できるのが大きなメリットです。まずは簡単なステップを繋げることから試してみてください！ 