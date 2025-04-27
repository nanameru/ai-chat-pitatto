---
title: "Mastra入門：エージェントとワークフローで AI 開発を加速"
emoji: "🤖"
type: "article"
topics: ["Mastra", "AI", "LLM", "Workflow", "Agent"]
published: false
---

# Mastra入門：エージェントとワークフローで AI 開発を加速

Mastra は、大規模言語モデル (LLM) を活用したアプリケーション開発を効率化するためのフレームワークです。複雑化しやすい AI アプリケーションの構成要素を整理し、開発・運用を容易にします。

## Mastra とは？

Mastra は、AI アプリケーション、特に LLM を中心としたエージェントシステムや複雑な処理フローを構築するための TypeScript ベースのフレームワークです。LLM に外部ツールへのアクセス能力や記憶（メモリ）機能を与えたり、複数の処理ステップを組み合わせたワークフローを定義・実行したりすることができます。

## 主な機能紹介

Mastra は主に以下の3つのコアコンポーネントで構成されています。

### 1. エージェント (Agent)

エージェントは、LLM を核とした自律的な処理単位です。Mastra の `Agent` クラスを使うことで、LLM に以下のような機能を追加できます。

*   **ツール (Tools):** 外部 API の呼び出しやデータベースアクセスなど、特定の機能を持つ「ツール」をエージェントに与え、LLM が必要に応じてそれらを呼び出せるようにします。
*   **メモリ (Memory):** 過去の対話履歴や処理結果を記憶させ、文脈に基づいた応答や判断を可能にします。
*   **音声入出力 (Voice):** テキストだけでなく、音声での対話を実現するためのインターフェースを提供します。

```typescript
import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { z } from 'zod';

// 簡単なツール例
const weatherTool = createTool({
  id: 'get_weather',
  description: '指定された場所の現在の天気を取得します',
  inputSchema: z.object({ location: z.string() }),
  outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
  execute: async ({ context }) => {
    // ここで天気APIなどを呼び出す
    console.log(`Fetching weather for ${context.location}...`);
    return { temperature: 25, condition: '晴れ' };
  },
});

// エージェント定義
export const weatherAgent = new Agent({
  name: 'weather-agent',
  instructions: 'ユーザーに指定された場所の天気を答えるアシスタントです。必要ならツールを使ってください。',
  model: openai('gpt-4o-mini'),
  tools: { weatherTool }, // 作成したツールを登録
});

// エージェントの実行 (例)
// const result = await weatherAgent.generate({ input: '東京の天気は？' });
// console.log(result.output);
```

### 2. ワークフロー (Workflow)

ワークフローは、複数の処理ステップを組み合わせて、より複雑なタスクを実現するための機能です。`Workflow` クラスと `Step` クラスを使って定義します。

*   **ステップ定義:** 個々の処理（API 呼び出し、データ処理、エージェント呼び出しなど）を `Step` として定義します。
*   **フロー制御:** ステップの実行順序（直列、並列）、条件分岐 (`if/else`)、繰り返し (`while`)、待機 (`suspend/resume`) などを柔軟に制御できます。
*   **エラーハンドリング:** リトライやフォールバック処理を設定できます。
*   **ネスト:** ワークフローの中に別のワークフローを組み込む（サブワークフロー）ことも可能です。

```typescript
import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';
import { mastra } from './index'; // Mastra インスタンスのインポートを想定

// ワークフロー定義
const simpleWorkflow = new Workflow({
  name: 'simple-workflow',
  triggerSchema: z.object({ query: z.string() }), // ワークフロー開始時の入力
  mastra,
});

// 1つ目のステップ
const step1 = new Step({
  id: 'step-1',
  description: 'クエリを大文字にする',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ upperQuery: z.string() }),
  execute: async ({ context }) => {
    return { upperQuery: context.triggerData.query.toUpperCase() };
  },
});

// 2つ目のステップ
const step2 = new Step({
  id: 'step-2',
  description: '大文字クエリを表示する',
  inputSchema: z.object({ upperQuery: z.string() }), // step1 の出力を使う
  execute: async ({ context }) => {
    console.log(`Processed query: ${context.inputData.upperQuery}`);
    return { success: true };
  },
});

// ワークフローの組み立てと確定
simpleWorkflow
  .step(step1) // 最初のステップ
  .step(step2, { input: (ctx) => ctx.steps.step1.output }) // step1の出力をstep2の入力に
  .commit();

// ワークフローの実行 (例)
// const run = simpleWorkflow.createRun({ query: 'hello mastra' });
// await run.start();
```

### 3. ツール (Tool)

ツールは、エージェントやワークフローから再利用可能な特定の機能を提供するコンポーネントです。`createTool` 関数で定義します。標準で用意されているツールもありますが、独自のツールを簡単に作成できます。

*   **Web 検索ツール**
*   **データベースアクセスツール**
*   **外部 API 連携ツール**
*   **ファイル操作ツール** など

## Mastra を使うメリット

*   **開発効率の向上:** エージェント、ワークフロー、ツールといったコンポーネントに責務を分割することで、コードの見通しが良くなり、開発・保守が容易になります。
*   **複雑な処理の実現:** 複数の LLM 呼び出しや外部システム連携を含む複雑な処理フローを、ワークフロー機能を使って構造化し、管理しやすくします。
*   **拡張性:** 新しいツールやエージェント、ワークフローを簡単に追加でき、アプリケーションの機能を段階的に拡張していくことが可能です。
*   **テスト容易性:** 各コンポーネント（特にツールやステップ）を個別にテストしやすくなります。

## まとめ

Mastra は、エージェントやワークフローといった強力な抽象化を提供することで、複雑な LLM アプリケーションの開発を支援するフレームワークです。本記事では基本的な概念を紹介しましたが、メモリ機能、RAG、評価 (Evals) など、さらに多くの機能があります。

ぜひ公式ドキュメントやサンプルを参考に、Mastra を使った AI アプリケーション開発を始めてみてください。

*   [Mastra 公式サイト](https://mastra.ai/)
*   [Mastra ドキュメント](https://mastra.ai/docs)
*   [Mastra GitHub](https://github.com/mastra-ai/mastra)
