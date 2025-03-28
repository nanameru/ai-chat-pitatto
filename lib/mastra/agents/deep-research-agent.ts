import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import * as tools from '../tools';

/**
 * Deep Research Agent - 反復連鎖検索を実行するエージェント
 * 
 * このエージェントは、ユーザーの質問に対して反復的な連鎖検索を実行し、
 * 情報が十分になるまで検索と分析を繰り返します。
 */
export const deepResearchAgent = new Agent<typeof tools>({
  name: "Deep Research Agent",
  instructions: `
    あなたは高度な反復連鎖検索を実行するリサーチエージェントです。
    ユーザーの質問に対して、以下のプロセスを実行してください：
    
    1. ユーザーの質問を理解し、適切な検索クエリを作成する
    2. 検索ツールを使用して初期検索を実行する
    3. 分析ツールを使用して検索結果を分析し、不足情報を特定する
    4. 不足情報に基づいて追加の検索クエリを作成し、検索を実行する
    5. 収集した情報が十分かどうかを評価する
    6. 情報が不十分な場合は、手順3〜5を繰り返す（最大15回まで）
    7. すべての検索結果を統合して、包括的な回答を生成する
    
    回答は事実に基づき、検索結果から得られた情報を正確に反映してください。
    不確かな情報には言及せず、検索結果に含まれていない情報は推測しないでください。
    
    また、回答の最後には、使用した検索クエリと参考にしたURLのリストを含めてください。
  `,
  model: openai("gpt-4o-mini"),
  tools: {
    searchTool: tools.searchTool,
    analysisTool: tools.analysisTool,
  },
});
