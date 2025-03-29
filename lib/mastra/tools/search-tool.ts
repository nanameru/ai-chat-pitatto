import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getJson } from "serpapi";

/**
 * 検索ツール - ウェブ検索を実行して結果を返す
 * 
 * このツールは、ユーザーの検索クエリに基づいてウェブ検索を実行し、
 * 検索結果を構造化されたデータとして返します。
 */
export const searchTool = createTool({
  id: "Web Search",
  inputSchema: z.object({
    query: z.string().describe("検索クエリ"),
  }),
  description: "ウェブ検索を実行して情報を取得します",
  execute: async ({ context: { query } }) => {
    console.log(`検索実行: ${query}`);
    console.log(`検索ツールが呼び出されました - ${new Date().toISOString()}`);
    
    try {
      // テスト用に常に詳細なモックデータを返す
      const mockResult = getEnhancedMockResults(query);
      console.log('詳細なモックデータを返します。検索結果数:', mockResult.results.length);
      return mockResult;
      
      /* 本番環境では以下のコードを使用
      // SerpAPIを使用して実際の検索を実行
      const apiKey = process.env.SERPAPI_API_KEY;
      
      if (!apiKey) {
        console.warn('SERPAPI_API_KEY が設定されていません。モックデータを返します。');
        const mockResult = getEnhancedMockResults(query);
        console.log('モックデータを返します:', JSON.stringify(mockResult, null, 2));
        return mockResult;
      }
      
      const params = {
        engine: "google",
        q: query,
        api_key: apiKey,
        hl: "ja"
      };
      
      const searchResults = await getJson(params);
      
      // 検索結果を整形
      const formattedResults = searchResults.organic_results?.map((result: any) => ({
        title: result.title || '',
        snippet: result.snippet || '',
        url: result.link || ''
      })) || [];
      
      return {
        query,
        results: formattedResults.length > 0 ? formattedResults : getEnhancedMockResults(query).results,
        timestamp: new Date().toISOString(),
      };
      */
    } catch (error) {
      console.error('検索APIでエラーが発生しました:', error);
      return getEnhancedMockResults(query);
    }
  },
});

// モックデータを返す関数
function getMockResults(query: string) {
  const mockResults = [
    { title: `${query}に関する情報1`, snippet: `これは${query}についての情報です。`, url: 'https://example.com/1' },
    { title: `${query}に関する情報2`, snippet: `${query}の詳細な解説です。`, url: 'https://example.com/2' },
  ];
  
  return {
    query,
    results: mockResults,
    timestamp: new Date().toISOString(),
  };
}

// より詳細なモックデータを返す関数
function getEnhancedMockResults(query: string) {
  // クエリに応じて異なるモックデータを返す
  const mockResults = [
    { 
      title: `${query} - 定義と基本概念`, 
      snippet: `${query}とは、コンピュータが人間のように考え、学習し、問題を解決する能力を指します。機械学習、深層学習、自然言語処理などの技術が含まれます。`, 
      url: 'https://example.com/definition' 
    },
    { 
      title: `${query}の具体的な事例と応用`, 
      snippet: `${query}の実際の応用例には、自動運転車、音声アシスタント、医療診断支援、推薦システムなどがあります。これらは日常生活やビジネスに革命をもたらしています。`, 
      url: 'https://example.com/examples' 
    },
    { 
      title: `${query}の市場への影響と経済効果`, 
      snippet: `${query}は2025年までに世界経済に約15兆ドルの価値をもたらすと予測されています。特に医療、金融、製造業での導入が進んでいます。`, 
      url: 'https://example.com/market-impact' 
    },
    { 
      title: `${query}の技術的詳細と仕組み`, 
      snippet: `${query}システムの中核には、ニューラルネットワークがあります。これは人間の脳の構造を模倣し、大量のデータから学習して精度を向上させます。`, 
      url: 'https://example.com/technical-details' 
    },
    { 
      title: `${query}の将来展望とトレンド`, 
      snippet: `${query}の今後のトレンドとしては、説明可能なAI、エッジAI、AIと人間の協働などが注目されています。倫理的なAI開発も重要なテーマです。`, 
      url: 'https://example.com/future-trends' 
    },
    { 
      title: `${query}の倫理的課題と規制`, 
      snippet: `${query}の発展に伴い、プライバシー、バイアス、雇用への影響、安全性などの倫理的課題が浮上しています。各国で規制フレームワークの整備が進んでいます。`, 
      url: 'https://example.com/ethics' 
    },
    { 
      title: `${query}の教育と学習リソース`, 
      snippet: `${query}を学ぶための優れたリソースには、オンラインコース、専門書、オープンソースプロジェクト、コミュニティフォーラムなどがあります。`, 
      url: 'https://example.com/education' 
    },
    { 
      title: `${query}の最新研究動向`, 
      snippet: `${query}の最新研究では、自己教師あり学習、マルチモーダルAI、少数ショット学習などが注目されています。研究成果の実用化も加速しています。`, 
      url: 'https://example.com/research' 
    },
    { 
      title: `${query}の導入事例と成功事例`, 
      snippet: `多くの企業が${query}を導入し、業務効率化やコスト削減、新サービス創出などで成功を収めています。具体的な事例とその効果が報告されています。`, 
      url: 'https://example.com/case-studies' 
    }
  ];
  
  return {
    query,
    results: mockResults,
    timestamp: new Date().toISOString(),
  };
}
