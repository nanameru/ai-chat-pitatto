// @ts-ignore - Mastraの型定義が見つからない問題を一時的に回避
import { Agent, createAgent } from '@mastra/core';
import { z } from 'zod';

// 検索ツールの定義
const searchTool = {
  name: 'search',
  description: 'ウェブ検索を実行して情報を取得します',
  parameters: z.object({
    query: z.string().describe('検索クエリ'),
  }),
  execute: async ({ query }: { query: string }) => {
    // 実際の検索実装はここに追加します
    // 現在はモック応答を返します
    console.log(`検索実行: ${query}`);
    return `「${query}」の検索結果: これはモックの検索結果です。実際の実装では外部APIを呼び出します。`;
  },
};

// 連鎖検索エージェントの作成
export const researchAgent: Agent = createAgent({
  name: 'DeepResearchAgent',
  description: '連鎖検索を実行し、情報を収集して最終的な文章を生成するエージェント',
  tools: [searchTool],
  systemPrompt: `あなたは連鎖検索を実行するリサーチエージェントです。
ユーザーの質問に対して以下のプロセスで対応してください：

1. ユーザーの入力を分析し、検索すべきキーワードや質問を特定する
2. 検索ツールを使用して情報を収集する
3. 検索結果を分析し、情報が不十分な場合は追加の検索を実行する
4. 十分な情報が集まったら、それらを統合して包括的な回答を生成する
5. 制限時間（10分）に達したら、それまでに収集した情報から最善の回答を生成する

常に正確で信頼性の高い情報を提供することを心がけてください。`,
});
