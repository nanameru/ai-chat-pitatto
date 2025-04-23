import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import OpenAI from 'openai';

// Web検索と要約のワークフロー定義
export const searchSummarizeWorkflow = new Workflow({
  name: 'test-test-search-summarize-workflow',
  triggerSchema: z.object({
    query: z.string().describe('Search query'),
  }),
});

// Web検索ステップ
const searchStep = new Step({
  id: 'web-search',
  description: 'Searches the web for information on a given query',
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string()
    })),
    query: z.string()
  }),
  execute: async ({ context }) => {
    // triggerデータから検索クエリを取得
    const query = context?.triggerData?.query;
    
    if (!query) {
      throw new Error('Search query not found');
    }
    
    // APIキーを環境変数から取得
    const apiKey = process.env.BRAVE_API_KEY;
    
    if (!apiKey) {
      throw new Error('BRAVE_API_KEY is not set in environment variables');
    }
    
    // 検索結果数を5に制限
    const count = 5;
    
    // Brave Search APIのエンドポイント
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Search failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 検索結果がない場合
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        query: query
      };
    }
    
    return {
      results: data.web.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      query: query
    };
  }
});

// 検索結果の要約ステップ
const summarizeStep = new Step({
  id: 'summarize-results',
  description: 'Summarizes the search results using AI',
  inputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string()
    })),
    query: z.string()
  }),
  outputSchema: z.object({
    summary: z.string(),
    query: z.string(),
    sources: z.array(z.string()).optional()
  }),
  execute: async ({ context }) => {
    // 前のステップの結果から入力を取得
    const webSearchResult = context?.getStepResult('web-search');
    
    if (!webSearchResult) {
      return {
        summary: 'No search results were found.',
        query: 'Unknown query'
      };
    }
    
    const { results, query } = webSearchResult;
    
    if (!results || results.length === 0) {
      return {
        summary: `No results found for the query: "${query}"`,
        query: query
      };
    }
    
    // 検索結果を整形してプロンプトに含める
    let formattedResults = results.map((result: any, index: number) => {
      return `[${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
    }).join('\n');
    
    // AIに渡すプロンプト
    const prompt = `以下は「${query}」についての検索結果です：

${formattedResults}

これらの検索結果を基に、以下の要件を満たす包括的な要約を作成してください：
1. 検索クエリに関連する主要な情報を要約する
2. 相反する見解がある場合は、それらを対比する
3. 最も信頼性の高い情報源からの情報を優先する
4. 要約は事実に基づき、明確で理解しやすい形式で提示する
5. 情報の出典（URLの数値参照）を含める

検索結果が少ない場合は、その旨を明記し、利用可能な情報に基づいて要約を作成してください。`;
    
    // AIモデルを使用して要約を生成
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800
    });
    
    return {
      summary: completion.choices[0].message.content || '要約を生成できませんでした。',
      query: query,
      sources: results.map((result: any) => result.url)
    };
  }
});

// ワークフローにステップを追加
searchSummarizeWorkflow
  .step(searchStep)
  .step(summarizeStep)
  .commit(); 