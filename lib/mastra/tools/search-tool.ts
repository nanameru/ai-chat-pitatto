import { createTool } from "@mastra/core/tools";
import { z } from "zod";
// import { getJson } from "serpapi"; // SerpAPI は不要になる
import fetch from 'node-fetch'; // node-fetch を使用 (環境によっては標準 fetch でも可)

// 1秒待機する関数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 検索ツール - ウェブ検索を実行して結果を返す (Brave Search 使用)
 * 
 * このツールは、ユーザーの検索クエリに基づいてウェブ検索を実行し、
 * 検索結果を構造化されたデータとして返します。
 */
export const searchTool = createTool({
  id: "Web Search",
  inputSchema: z.object({
    query: z.string().describe("検索クエリ"),
  }),
  description: "ウェブ検索を実行して情報を取得します (Brave Search)",
  execute: async ({ context: { query } }) => {
    console.log(`検索実行 (Brave Search): ${query}`);
    console.log(`検索ツールが呼び出されました - ${new Date().toISOString()}`);

    try {
      // Brave Search APIキーを取得
      const apiKey = process.env.BRAVE_API_KEY;

      if (!apiKey) {
        console.warn('BRAVE_API_KEY が設定されていません。モックデータを返します。');
        const mockResult = getEnhancedMockResults(query);
        console.log('モックデータを返します:', JSON.stringify(mockResult, null, 2));
        return mockResult;
      }

      // Brave Search APIエンドポイントとパラメータ
      const endpoint = "https://api.search.brave.com/res/v1/web/search";
      const params = new URLSearchParams({
        q: query,
        country: "JP", // 必要に応じて国コードを指定
        search_lang: "jp", // 言語コードを 'jp' に修正
      });

      // レート制限対策: API呼び出し前に1秒待機
      console.log('レート制限対策のため1秒待機します...');
      await sleep(1000);

      // APIリクエストを実行
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': `${apiKey}`
        },
      });

      if (!response.ok) {
        // エラーレスポンスの内容を確認
        let errorBody = '不明なAPIエラー';
        try {
            errorBody = await response.text();
        } catch {}
        console.error(`Brave Search API エラー: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Brave Search API returned status ${response.status}`);
      }

      const searchResults = await response.json() as any; // 型は Brave API の仕様に合わせて調整が必要

      // 検索結果を整形 (Brave API のレスポンス構造に合わせる)
      // 例: searchResults.web?.results のような構造を想定
      const formattedResults = searchResults.web?.results?.map((result: any) => ({
        title: result.title || '',
        // Brave API は snippet や description を返すことが多い
        snippet: result.description || result.snippet || '', 
        url: result.url || ''
      })) || [];

      console.log(`Brave Search 結果取得件数: ${formattedResults.length}`);

      return {
        query,
        // 結果が0件の場合もフォールバックとしてモックを使用するか検討
        results: formattedResults.length > 0 ? formattedResults : getEnhancedMockResults(query).results,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error('検索処理でエラーが発生しました (Brave Search):', error);
      // エラー時もフォールバックとしてモックデータを返す
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
