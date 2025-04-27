---
title: "Mastra Agent Memory の使い方：コンテキスト管理を極める"
emoji: "🧠"
type: "article"
topics: ["Mastra", "Memory", "LLM", "Agent", "Workflow"]
published: false
---

# Mastra Agent Memory の使い方：コンテキスト管理を極める

Mastra の **Memory** 機能は、エージェントがチャット履歴や外部情報を効率的に保持し、必要なタイミングで思い出すための仕組みです。本記事では、Mastra メモリの全体像と、

* 作業記憶 (Working Memory)
* 意味記憶 (Semantic Recall)
* メモリプロセッサ (Memory Processors)

…を中心に、実装方法とベストプラクティスを紹介します。

> 公式ドキュメント: [メモリ概要](https://mastra.ai/ja/docs/memory/overview) / [Semantic Recall](https://mastra.ai/ja/docs/memory/semantic-recall) / [Working Memory](https://mastra.ai/ja/docs/memory/working-memory) / [Memory Processors](https://mastra.ai/ja/docs/memory/memory-processors)

---

## 1. Mastra におけるメモリとは？

Mastra では、エージェントが扱う **コンテキストウィンドウ** を次の 3 つに分割して管理します。

| 区分 | 説明 |
|------|------|
| **システム指示 + ワーキングメモリ** | エージェントの役割やユーザー属性など、常時参照したい情報 |
| **メッセージ履歴 (最近の n 件)** | 直近の会話を保持する短期記憶 |
| **セマンティック検索** | 古いメッセージから関連性の高いものを再検索して挿入 |

これらを組み合わせることで、**長い会話でも必要な情報だけを的確に LLM へ渡す**ことができます [[overview]](https://mastra.ai/ja/docs/memory/overview)。

---

## 2. 作業記憶 (Working Memory)

作業記憶は「ユーザーの属性」や「タスクの進行状況」など、**会話を通じて一貫して保持したい短期的な情報**を格納します。

```ts
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

export const profileAgent = new Agent({
  name: "profile-agent",
  instructions: "あなたはユーザープロファイルを覚えるアシスタントです。",
  model: openai("gpt-4o-mini"),
  memory: new Memory(), // デフォルトで Working Memory が有効
});
```

デフォルトでは **最新 40 件** のメッセージが自動で挿入されますが、`options.lastMessages` で調整可能です [[working-memory]](https://mastra.ai/ja/docs/memory/working-memory)。

---

## 3. セマンティックリコール (Semantic Recall)

古いメッセージをすべて送るとトークンが肥大化します。Mastra は **ベクターストア** に埋め込んだ履歴を保持し、**クエリに関連するメッセージだけを再検索（リコール）**して挿入します [[semantic-recall]](https://mastra.ai/ja/docs/memory/semantic-recall)。

```ts
const memory = new Memory({
  semanticRecall: {
    enabled: true,
    topK: 5,          // 取り出す件数
    similarity: 0.8,  // 類似度しきい値
  },
});
```

これにより長期履歴でも **必要最小限の情報** だけを LLM に渡せます。

---

## 4. メモリプロセッサ (Memory Processors)

それでもコンテキストが長すぎる場合は **Memory Processor** でトリミングや要約を行えます [[memory-processors]](https://mastra.ai/ja/docs/memory/memory-processors)。

```ts
import { SummarizeProcessor } from "@mastra/memory";

const memory = new Memory({
  processors: [new SummarizeProcessor({
    maxTokens: 500, // 上限を超えたら自動要約して置き換え
  })],
});
```

### 組み込みプロセッサ例

| プロセッサ | 目的 |
|------------|------|
| **SummarizeProcessor** | 過去メッセージを要約して圧縮 |
| **TrimProcessor** | 古いメッセージを指定トークン数まで削除 |

独自実装も `implements MemoryProcessor` で追加可能です。

---

## 5. スレッド管理 (resourceId / threadId)

メモリは **スレッド単位** で管理されます。以下 2 つの識別子を必ず渡しましょう。

1. `resourceId` – ユーザーや組織など所有者 ID
2. `threadId` – 会話の一意 ID

```ts
await profileAgent.stream("好きな色は青です。", {
  resourceId: "user_123",
  threadId: "chat_abc",
});
```

これがないと別会話と混在してしまうので注意してください。

---

## 6. クイックスタート手順まとめ

1. `npm install @mastra/memory`
2. `new Memory()` をエージェントに渡す
3. `resourceId` と `threadId` を各リクエストに付与
4. 必要に応じて `semanticRecall` や `processors` を設定

---

## 7. ベストプラクティス

* **短期 vs 長期** を意識して情報を保存する
* 不必要な履歴は `TrimProcessor` で削除
* 要約は誤情報リスクがあるため重要データは削除せず保存
* ユーザー属性は Working Memory に、詳細履歴は Semantic Recall に

---

## まとめ

Mastra の Memory 機能を使うと、LLM に与えるコンテキストを **自動で整理＆最適化** できます。Working Memory・Semantic Recall・Memory Processor を組み合わせれば、

* 長い会話でも必要情報を保持
* トークンコストを節約
* エージェント応答の一貫性を向上

ぜひプロジェクトに導入して、より賢いエージェントを開発してみてください！

---

引用:

* [Mastra Memory Overview](https://mastra.ai/ja/docs/memory/overview)
* [Semantic Recall](https://mastra.ai/ja/docs/memory/semantic-recall)
* [Working Memory](https://mastra.ai/ja/docs/memory/working-memory)
* [Memory Processors](https://mastra.ai/ja/docs/memory/memory-processors)
