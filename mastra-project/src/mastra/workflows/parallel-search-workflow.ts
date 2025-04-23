import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import OpenAI from 'openai';

// 第1の検索ステップ
const firstSearchStep = new Step({
  id: 'first-search',
  description: 'Performs web search using the first query',
  execute: async ({ context }) => {
    const queries = context?.triggerData?.queries;
    
    if (!queries || !Array.isArray(queries) || queries.length < 1) {
      throw new Error('Search queries not found or invalid');
    }
    
    const query = queries[0];
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
      throw new Error(`First search failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        query
      };
    }
    
    return {
      results: data.web.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      query
    };
  }
});

// 第1の検索結果の要約ステップ
const summarizeFirstStep = new Step({
  id: 'summarize-first',
  description: 'Summarizes the results of the first search',
  execute: async ({ context }) => {
    const searchResult = context?.getStepResult('first-search');
    
    if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
      return {
        summary: `No results found for the query: "${searchResult?.query || 'unknown'}"`,
        query: searchResult?.query || 'unknown'
      };
    }
    
    // 検索結果を整形
    let formattedResults = searchResult.results.map((result: any, index: number) => {
      return `[${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
    }).join('\n');
    
    // OpenAI を使用して要約を生成
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `以下は「${searchResult.query}」に関する検索結果です：

${formattedResults}

これらの検索結果を簡潔に要約してください。要約は150単語以内にしてください。`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 300
    });
    
    return {
      summary: completion.choices[0].message.content || '要約を生成できませんでした。',
      query: searchResult.query,
      sources: searchResult.results.map((r: any) => r.url)
    };
  }
});

// 第2の検索ステップ
const secondSearchStep = new Step({
  id: 'second-search',
  description: 'Performs web search using the second query',
  execute: async ({ context }) => {
    const queries = context?.triggerData?.queries;
    
    if (!queries || !Array.isArray(queries) || queries.length < 2) {
      throw new Error('Second search query not found or invalid');
    }
    
    const query = queries[1];
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
        query
      };
    }
    
    return {
      results: data.web.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      query
    };
  }
});

// 第2の検索結果の要約ステップ
const summarizeSecondStep = new Step({
  id: 'summarize-second',
  description: 'Summarizes the results of the second search',
  execute: async ({ context }) => {
    const searchResult = context?.getStepResult('second-search');
    
    if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
      return {
        summary: `No results found for the query: "${searchResult?.query || 'unknown'}"`,
        query: searchResult?.query || 'unknown'
      };
    }
    
    // 検索結果を整形
    let formattedResults = searchResult.results.map((result: any, index: number) => {
      return `[${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
    }).join('\n');
    
    // OpenAI を使用して要約を生成
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `以下は「${searchResult.query}」に関する検索結果です：

${formattedResults}

これらの検索結果を簡潔に要約してください。要約は150単語以内にしてください。`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 300
    });
    
    return {
      summary: completion.choices[0].message.content || '要約を生成できませんでした。',
      query: searchResult.query,
      sources: searchResult.results.map((r: any) => r.url)
    };
  }
});

// 第3の検索ステップ
const thirdSearchStep = new Step({
  id: 'third-search',
  description: 'Performs web search using the third query',
  execute: async ({ context }) => {
    const queries = context?.triggerData?.queries;
    
    if (!queries || !Array.isArray(queries) || queries.length < 3) {
      throw new Error('Third search query not found or invalid');
    }
    
    const query = queries[2];
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
      throw new Error(`Third search failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        query
      };
    }
    
    return {
      results: data.web.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      query
    };
  }
});

// 第3の検索結果の要約ステップ
const summarizeThirdStep = new Step({
  id: 'summarize-third',
  description: 'Summarizes the results of the third search',
  execute: async ({ context }) => {
    const searchResult = context?.getStepResult('third-search');
    
    if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
      return {
        summary: `No results found for the query: "${searchResult?.query || 'unknown'}"`,
        query: searchResult?.query || 'unknown'
      };
    }
    
    // 検索結果を整形
    let formattedResults = searchResult.results.map((result: any, index: number) => {
      return `[${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
    }).join('\n');
    
    // OpenAI を使用して要約を生成
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `以下は「${searchResult.query}」に関する検索結果です：

${formattedResults}

これらの検索結果を簡潔に要約してください。要約は150単語以内にしてください。`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 300
    });
    
    return {
      summary: completion.choices[0].message.content || '要約を生成できませんでした。',
      query: searchResult.query,
      sources: searchResult.results.map((r: any) => r.url)
    };
  }
});

// 統合ステップ
const integrationStep = new Step({
  id: 'integrate-results',
  description: 'Integrates the summaries from all three searches',
  execute: async ({ context }) => {
    const firstSummary = context?.getStepResult('summarize-first');
    const secondSummary = context?.getStepResult('summarize-second');
    const thirdSummary = context?.getStepResult('summarize-third');
    
    // 各要約とクエリを含めたオブジェクトを作成
    const results = [
      {
        query: firstSummary?.query || 'unknown',
        summary: firstSummary?.summary || 'No summary available',
        sources: firstSummary?.sources || []
      },
      {
        query: secondSummary?.query || 'unknown',
        summary: secondSummary?.summary || 'No summary available',
        sources: secondSummary?.sources || []
      },
      {
        query: thirdSummary?.query || 'unknown',
        summary: thirdSummary?.summary || 'No summary available',
        sources: thirdSummary?.sources || []
      }
    ];
    
    // OpenAI を使用して統合レポートを生成
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `以下は3つの異なるクエリに基づく検索結果の要約です：

# クエリ1: ${results[0].query}
${results[0].summary}

# クエリ2: ${results[1].query}
${results[1].summary}

# クエリ3: ${results[2].query}
${results[2].summary}

これら3つの要約を組み合わせて、以下の要件を満たす統合レポートを作成してください：
1. 3つのクエリにわたる主要な発見や傾向についての短い導入部
2. 各トピックの類似点と相違点の分析
3. 全体の結論と洞察
4. 重要な発見と情報源の要約

レポートは明確でわかりやすく、相互参照を含み、それぞれのクエリからの情報がどのように関連しているかを示してください。`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1000
    });
    
    // すべてのURLを収集
    const allSources = [
      ...firstSummary?.sources || [],
      ...secondSummary?.sources || [],
      ...thirdSummary?.sources || []
    ];
    
    return {
      integratedReport: completion.choices[0].message.content || '統合レポートを生成できませんでした。',
      summaries: results,
      sources: allSources
    };
  }
});

// 並列検索ワークフローの定義
export const parallelSearchWorkflow = new Workflow({
  name: 'test-parallel-search-workflow',
  triggerSchema: z.object({
    queries: z.array(z.string()).min(3).describe('Array of three search queries'),
  }),
});

// ワークフローにステップを並列に追加
parallelSearchWorkflow
  .step(firstSearchStep)
    .then(summarizeFirstStep)
  .step(secondSearchStep)
    .then(summarizeSecondStep)
  .step(thirdSearchStep)
    .then(summarizeThirdStep)
  .step(integrationStep)
  .commit(); 