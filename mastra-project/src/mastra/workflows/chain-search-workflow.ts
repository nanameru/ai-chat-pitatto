import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import OpenAI from 'openai';

// 初期Web検索ステップ
const initialSearchStep = new Step({
  id: 'initial-search',
  description: 'Performs the initial web search based on the user query',
  execute: async ({ context }) => {
    const query = context?.triggerData?.query;
    
    if (!query) {
      throw new Error('Search query not found');
    }
    
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      throw new Error('BRAVE_API_KEY is not set in environment variables');
    }
    
    const count = 3; // 最初の検索では少なめに
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
    
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        query: query,
        nextQuery: query // 結果がない場合は同じクエリを使用
      };
    }
    
    // 検索結果とオリジナルクエリを返す
    return {
      results: data.web.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      query: query,
      originalQuery: query // 元のクエリを保存
    };
  }
});

// 次のクエリを生成するステップ
const generateSecondQueryStep = new Step({
  id: 'generate-second-query',
  description: 'Generates a more specific search query based on the initial search results',
  execute: async ({ context }) => {
    const previousStepResult = context?.getStepResult('initial-search');
    
    if (!previousStepResult || !previousStepResult.results || previousStepResult.results.length === 0) {
      return {
        nextQuery: previousStepResult?.query || 'AI technology trends',
        originalQuery: previousStepResult?.originalQuery
      };
    }
    
    // 検索結果を整形
    let formattedResults = previousStepResult.results.map((result: any, index: number) => {
      return `[${index + 1}] ${result.title}
${result.description}
`;
    }).join('\n');
    
    // OpenAI を使用して次のクエリを生成
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `以下は「${previousStepResult.query}」に関する検索結果です：

${formattedResults}

これらの検索結果に基づいて、より詳細かつ具体的な新しい検索クエリを作成してください。
この新しいクエリは、元のクエリを発展させ、より深い情報を得るためのものです。
最も興味深いと思われるトピックに焦点を当て、50文字以内の簡潔な検索クエリを作成してください。
クエリはそのまま検索エンジンに入力できる形式にしてください。引用符や特殊な演算子は使用しないでください。`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 100
    });
    
    const nextQuery = completion.choices[0].message.content?.trim() || previousStepResult.query;
    
    return {
      nextQuery,
      originalQuery: previousStepResult.originalQuery,
      previousResults: previousStepResult.results
    };
  }
});

// 2回目の検索ステップ
const secondSearchStep = new Step({
  id: 'second-search',
  description: 'Performs the second web search based on the generated query',
  execute: async ({ context }) => {
    const previousStepResult = context?.getStepResult('generate-second-query');
    
    if (!previousStepResult || !previousStepResult.nextQuery) {
      throw new Error('Second search query not found');
    }
    
    const query = previousStepResult.nextQuery;
    const apiKey = process.env.BRAVE_API_KEY;
    
    if (!apiKey) {
      throw new Error('BRAVE_API_KEY is not set in environment variables');
    }
    
    const count = 3;
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Second search failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        query: query,
        originalQuery: previousStepResult.originalQuery,
        previousResults: previousStepResult.previousResults
      };
    }
    
    return {
      results: data.web.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      query: query,
      originalQuery: previousStepResult.originalQuery,
      previousResults: previousStepResult.previousResults
    };
  }
});

// 最終クエリを生成するステップ
const generateFinalQueryStep = new Step({
  id: 'generate-final-query',
  description: 'Generates the final search query based on the first two search results',
  execute: async ({ context }) => {
    const previousStepResult = context?.getStepResult('second-search');
    
    if (!previousStepResult) {
      throw new Error('Previous search results not found');
    }
    
    // 先行する検索結果がない場合
    if (!previousStepResult.results || previousStepResult.results.length === 0) {
      return {
        nextQuery: previousStepResult.query || 'AI technology latest applications',
        originalQuery: previousStepResult.originalQuery,
        firstResults: previousStepResult.previousResults || [],
        secondResults: []
      };
    }
    
    // 2回目の検索結果を整形
    let formattedResults = previousStepResult.results.map((result: any, index: number) => {
      return `[${index + 1}] ${result.title}
${result.description}
`;
    }).join('\n');
    
    // OpenAI を使用して最終クエリを生成
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `以下は「${previousStepResult.query}」に関する検索結果です：

${formattedResults}

最初の検索クエリは「${previousStepResult.originalQuery}」でした。
これまでの検索結果に基づいて、さらに専門的で具体的な最終検索クエリを作成してください。
このクエリは、これまでに見つかっていない深い洞察や実際の応用例を見つけるためのものです。
最も重要な側面や興味深い発展に焦点を当て、50文字以内の簡潔な検索クエリを作成してください。
クエリはそのまま検索エンジンに入力できる形式にしてください。引用符や特殊な演算子は使用しないでください。`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 100
    });
    
    const nextQuery = completion.choices[0].message.content?.trim() || previousStepResult.query;
    
    return {
      nextQuery,
      originalQuery: previousStepResult.originalQuery,
      firstResults: previousStepResult.previousResults || [],
      secondResults: previousStepResult.results
    };
  }
});

// 最終検索ステップ
const finalSearchStep = new Step({
  id: 'final-search',
  description: 'Performs the final web search based on the generated query',
  execute: async ({ context }) => {
    const previousStepResult = context?.getStepResult('generate-final-query');
    
    if (!previousStepResult || !previousStepResult.nextQuery) {
      throw new Error('Final search query not found');
    }
    
    const query = previousStepResult.nextQuery;
    const apiKey = process.env.BRAVE_API_KEY;
    
    if (!apiKey) {
      throw new Error('BRAVE_API_KEY is not set in environment variables');
    }
    
    const count = 3;
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Final search failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        query: query,
        originalQuery: previousStepResult.originalQuery,
        firstResults: previousStepResult.firstResults,
        secondResults: previousStepResult.secondResults
      };
    }
    
    return {
      results: data.web.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      query: query,
      originalQuery: previousStepResult.originalQuery,
      firstResults: previousStepResult.firstResults,
      secondResults: previousStepResult.secondResults
    };
  }
});

// 結果の要約と統合ステップ
const summarizeResultsStep = new Step({
  id: 'summarize-results',
  description: 'Summarizes all search results and provides a comprehensive report',
  execute: async ({ context }) => {
    const previousStepResult = context?.getStepResult('final-search');
    
    if (!previousStepResult) {
      throw new Error('Final search results not found');
    }
    
    const originalQuery = previousStepResult.originalQuery;
    const secondQuery = previousStepResult.query; // 最終クエリ
    const firstResults = previousStepResult.firstResults || [];
    const secondResults = previousStepResult.secondResults || [];
    const finalResults = previousStepResult.results || [];
    
    // すべての検索結果を整形
    let formattedFirstResults = firstResults.map((result: any, index: number) => {
      return `[1.${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
    }).join('\n');
    
    let formattedSecondResults = secondResults.map((result: any, index: number) => {
      return `[2.${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
    }).join('\n');
    
    let formattedFinalResults = finalResults.map((result: any, index: number) => {
      return `[3.${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
    }).join('\n');
    
    // OpenAI を使用して要約を生成
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `以下は元のクエリ「${originalQuery}」に関連する3段階の検索結果です。

# 第1段階の検索結果:
${formattedFirstResults || '検索結果はありませんでした。'}

# 第2段階の検索結果（クエリ: ${previousStepResult.secondResults?.[0]?.query || '不明'}）:
${formattedSecondResults || '検索結果はありませんでした。'}

# 第3段階の検索結果（クエリ: ${secondQuery}）:
${formattedFinalResults || '検索結果はありませんでした。'}

これらの検索結果すべてに基づいて、以下の要件を満たす包括的な要約レポートを作成してください：

1. 元の検索クエリの概要と、各段階でどのように検索が進化したかを説明する短い導入部
2. 3段階の検索から得られた主要な洞察や知見を統合した本文
3. 結論と、読者が探求できる関連トピックの提案
4. 使用したすべての情報源のリスト（各情報源を[段階.番号]形式で引用する）

要約は客観的で包括的であるべきで、矛盾する見解がある場合はそれらを対比してください。
`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1500
    });
    
    // すべてのURLを収集
    const allSources = [
      ...firstResults.map((r: any) => r.url),
      ...secondResults.map((r: any) => r.url),
      ...finalResults.map((r: any) => r.url)
    ];
    
    return {
      summary: completion.choices[0].message.content || '要約を生成できませんでした。',
      originalQuery,
      secondQuery,
      sources: allSources,
      searchJourney: {
        firstQuery: originalQuery,
        secondQuery: previousStepResult.secondResults?.[0]?.query || '不明',
        finalQuery: secondQuery
      }
    };
  }
});

// チェーン検索ワークフローの定義
export const chainSearchWorkflow = new Workflow({
  name: 'test-chain-search-workflow',
  triggerSchema: z.object({
    query: z.string().describe('Initial search query'),
  }),
});

// ワークフローにステップを連鎖的に追加
chainSearchWorkflow
  .step(initialSearchStep)
  .then(generateSecondQueryStep)
  .then(secondSearchStep)
  .then(generateFinalQueryStep)
  .then(finalSearchStep)
  .then(summarizeResultsStep)
  .commit(); 