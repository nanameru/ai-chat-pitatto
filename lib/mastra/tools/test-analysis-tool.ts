import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * テスト用分析ツール - 検索結果を分析し、常に反復を続ける
 * 
 * このツールは、検索結果を分析して、ユーザーの質問に対して
 * 不足している情報や追加調査が必要な点を特定します。
 * テスト目的で常に「不十分」と判断し、最大反復回数まで検索を続けます。
 */
export const testAnalysisTool = createTool({
  id: "Search Results Analysis",
  inputSchema: z.object({
    query: z.string().describe("元の検索クエリ"),
    results: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })).describe("検索結果"),
    iteration: z.number().optional().describe("現在の検索反復回数"),
    maxIterations: z.number().optional().describe("最大反復回数"),
  }),
  description: "検索結果を分析し、情報の十分さを10点満点でスコアリングし、必要に応じて追加の検索クエリを提案します",
  execute: async ({ context: { query, results, iteration = 1, maxIterations = 10 } }) => {
    console.log(`分析実行: ${query}の検索結果を分析 (反復回数: ${iteration}/${maxIterations})`);
    console.log(`検索結果数: ${results?.length || 0}`);
    
    // 最大反復回数に達した場合は終了
    if (iteration >= maxIterations) {
      console.log(`最大反復回数(${maxIterations})に達しました。検索を終了します。`);
      return {
        originalQuery: query,
        completenessScore: 7, // 最大反復回数に達した場合は妥当なスコアを設定
        missingInformation: ['最大反復回数に達しました'],
        followUpQueries: [],
        isSufficient: true, // 強制終了
        iteration: iteration,
        maxIterations: maxIterations,
        analysisTimestamp: new Date().toISOString(),
      };
    }
    
    console.log(`テスト用分析ツール: 反復回数 ${iteration}/${maxIterations}、まだ続行します`);
    
    // 検索結果がない場合
    if (!results || results.length === 0) {
      console.log(`検索結果がありません。基本的なフォローアップクエリを生成します。`);
      return {
        originalQuery: query,
        completenessScore: 1, // 1/10 (非常に不十分)
        missingInformation: ['基本的な情報が不足しています'],
        followUpQueries: [
          `${query} 定義 基本概念`,
          `${query} 最新情報 トレンド`,
          `${query} 具体例 事例`
        ],
        isSufficient: false,
        iteration: iteration + 1,
        maxIterations: maxIterations,
        analysisTimestamp: new Date().toISOString(),
      };
    }
    
    // 検索結果からタイトルとスニペットを抽出
    const titles = results.map(r => r.title).join('\n');
    const snippets = results.map(r => r.snippet).join('\n');
    
    // 検索結果の内容に基づいて、キーワードを抽出
    const keywords = extractKeywords(`${titles}\n${snippets}`);
    
    // 情報の十分さを評価（10点満点）
    const completenessEvaluation = evaluateCompleteness(results, query);
    const completenessScore = completenessEvaluation.score;
    const criteriaDetails = completenessEvaluation.criteriaDetails;
    
    // テスト目的で常に「不十分」と判断する（スコアに関わらず）
    const isSufficient = false;
    console.log(`テスト用分析ツール: isSufficientを強制的にfalseに設定しました`);
    
    console.log(`情報の十分さ評価: ${completenessScore}/10 - ${isSufficient ? '十分' : '不十分'}`);
    console.log(`評価スコア: ${completenessScore.toFixed(1)}/10 (結果数: ${criteriaDetails.resultCount.score.toFixed(1)}, 関連性: ${criteriaDetails.contentRelevance.score.toFixed(1)}, 多様性: ${criteriaDetails.diversityOfSources.score.toFixed(1)}, 詳細度: ${criteriaDetails.detailLevel.score.toFixed(1)}, カバレッジ: ${criteriaDetails.coverageOfAspects.score.toFixed(1)})`);
    
    // 不足情報を特定
    const { missingInfo, aspectScores } = identifyMissingInformation(results, query);
    
    // テスト目的で常に何らかの不足情報を返す
    const testMissingInfo = missingInfo.length > 0 ? missingInfo : ['テスト目的の追加情報'];
    
    console.log(`不足情報: ${testMissingInfo.join(', ')}`);
    
    // 検索結果の全体的な分析
    const analysisText = `検索結果の分析:
- 全体的な完全性スコア: ${completenessScore}/10
- 各評価基準のスコア:
  - ${criteriaDetails.resultCount.description}: ${criteriaDetails.resultCount.score.toFixed(1)}/${criteriaDetails.resultCount.max}
  - ${criteriaDetails.contentRelevance.description}: ${criteriaDetails.contentRelevance.score.toFixed(1)}/${criteriaDetails.contentRelevance.max}
  - ${criteriaDetails.diversityOfSources.description}: ${criteriaDetails.diversityOfSources.score.toFixed(1)}/${criteriaDetails.diversityOfSources.max}
  - ${criteriaDetails.detailLevel.description}: ${criteriaDetails.detailLevel.score.toFixed(1)}/${criteriaDetails.detailLevel.max}
  - ${criteriaDetails.coverageOfAspects.description}: ${criteriaDetails.coverageOfAspects.score.toFixed(1)}/${criteriaDetails.coverageOfAspects.max}

- 各側面のカバレッジ:
${aspectScores.map(a => `  - ${a.name}: ${(a.score * 100).toFixed(0)}%`).join('\n')}

- 不足している情報: ${testMissingInfo.length > 0 ? testMissingInfo.join(', ') : 'なし'}`;

    // 次の検索クエリを生成
    let nextQueryReason = '';
    
    // フォローアップクエリの生成
    const allFollowUpQueries = generateFollowUpQueries(query, keywords, testMissingInfo);
    const nextQuery = allFollowUpQueries.length > 0 ? [allFollowUpQueries[0]] : [`${query} テスト反復 ${iteration + 1}`];
    
    if (testMissingInfo.length > 0) {
      // 最もスコアが低い側面を特定
      const lowestScoringAspect = aspectScores
        .filter(a => testMissingInfo.includes(a.name))
        .sort((a, b) => a.score - b.score)[0];
      
      if (lowestScoringAspect) {
        nextQueryReason = `「${lowestScoringAspect.name}」に関する情報が不足しているため、この側面に焦点を当てた検索を行います。`;
      } else {
        nextQueryReason = `${testMissingInfo[0]}に関する情報が不足しているため、この側面に焦点を当てた検索を行います。`;
      }
    } else {
      nextQueryReason = `テスト目的で追加の検索を行います（反復 ${iteration + 1}/${maxIterations}）。`;
    }
    
    console.log(`情報が不十分です (スコア: ${completenessScore}/10)。次の検索クエリ: ${nextQuery.join(', ')}`);
    console.log(`次のクエリの理由: ${nextQueryReason}`);
    
    // 必ずisSufficientをfalseに設定して返却
    const result = {
      originalQuery: query,
      completenessScore,
      missingInformation: testMissingInfo,
      followUpQueries: nextQuery,
      nextQueryReason,
      analysisText,
      criteriaDetails: Object.entries(criteriaDetails).map(([key, value]) => ({
        name: value.description,
        score: value.score,
        max: value.max
      })),
      aspectScores,
      isSufficient: false, // 常に不十分と判断
      iteration: iteration + 1,
      maxIterations: maxIterations,
      analysisTimestamp: new Date().toISOString(),
    };
    
    console.log(`テスト用分析ツール: 結果を返却します - isSufficient: ${result.isSufficient}, iteration: ${result.iteration}/${result.maxIterations}`);
    return result;
  },
});

/**
 * テキストからキーワードを抽出するヘルパー関数
 */
function extractKeywords(text: string): string[] {
  // 簡易的なキーワード抽出
  const words = text.toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['and', 'the', 'for', 'with', 'this', 'that'].includes(w));
  
  // 出現频度のカウント
  const wordCount = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // 频度順にソートして上位5つを取得
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * 情報の十分さを評価する関数（10点満点）
 */
function evaluateCompleteness(results: any[], query: string): { score: number; criteriaDetails: Record<string, { score: number; description: string; max: number }> } {
  // 評価基準
  const criteria: Record<string, { score: number; description: string; max: number }> = {
    resultCount: { score: 0, description: '結果の数', max: 2 },
    contentRelevance: { score: 0, description: '内容の関連性', max: 2 },
    diversityOfSources: { score: 0, description: '情報源の多様性', max: 2 },
    detailLevel: { score: 0, description: '詳細度', max: 2 },
    coverageOfAspects: { score: 0, description: '側面のカバレッジ', max: 2 },
  };
  
  // 結果の数による評価（0-2点）
  criteria.resultCount.score = Math.min(results.length / 5, 2);
  
  // 内容の関連性（0-2点）
  const queryTerms = query.toLowerCase().split(/\s+/);
  const relevanceScores = results.map(r => {
    const titleLower = r.title.toLowerCase();
    const snippetLower = r.snippet.toLowerCase();
    const relevantTermCount = queryTerms.filter(term => 
      titleLower.includes(term) || snippetLower.includes(term)
    ).length;
    return relevantTermCount / queryTerms.length;
  });
  criteria.contentRelevance.score = Math.min(
    relevanceScores.reduce((sum, score) => sum + score, 0) / results.length * 2,
    2
  );
  
  // 情報源の多様性（0-2点）
  const uniqueDomains = new Set(
    results.map(r => {
      try {
        const url = new URL(r.url);
        return url.hostname;
      } catch (e) {
        return r.url;
      }
    })
  );
  criteria.diversityOfSources.score = Math.min(uniqueDomains.size / 3, 2);
  
  // 詳細度（0-2点）
  const avgSnippetLength = results.reduce((sum, r) => sum + r.snippet.length, 0) / results.length;
  criteria.detailLevel.score = Math.min(avgSnippetLength / 100, 2);
  
  // 側面のカバレッジ（0-2点）
  const aspects = [
    { name: '定義と基本概念', keywords: ['定義', '基本', '概念', 'とは', '仕組み', '原理'] },
    { name: '具体的な事例', keywords: ['事例', '実例', 'ケース', '応用', '実装', '使用例'] },
    { name: '市場への影響', keywords: ['市場', '経済', '影響', 'ビジネス', '産業', '企業'] },
    { name: '技術的詳細', keywords: ['技術', '詳細', '仕様', '実装', 'アーキテクチャ', '開発'] },
    { name: '将来の展望', keywords: ['将来', '展望', '予測', '未来', 'トレンド', '発展'] },
  ];
  
  const aspectCoverage = aspects.map(aspect => {
    const coverage = results.filter(r => {
      const text = (`${r.title} ${r.snippet}`).toLowerCase();
      return aspect.keywords.some(keyword => text.includes(keyword));
    }).length / results.length;
    return { ...aspect, coverage };
  });
  
  const avgAspectCoverage = aspectCoverage.reduce((sum, a) => sum + a.coverage, 0) / aspects.length;
  criteria.coverageOfAspects.score = avgAspectCoverage * 2;
  
  // 総合スコア（10点満点）
  const totalScore = Object.values(criteria).reduce((sum, criterion) => sum + criterion.score, 0);
  
  return {
    score: totalScore,
    criteriaDetails: criteria
  };
}

/**
 * 不足している情報を特定する関数
 */
function identifyMissingInformation(results: any[], query: string): { missingInfo: string[], aspectScores: { name: string, score: number }[] } {
  const aspects = [
    { name: '定義と基本概念', keywords: ['定義', '基本', '概念', 'とは', '仕組み', '原理'] },
    { name: '具体的な事例', keywords: ['事例', '実例', 'ケース', '応用', '実装', '使用例'] },
    { name: '市場への影響', keywords: ['市場', '経済', '影響', 'ビジネス', '産業', '企業'] },
    { name: '技術的詳細', keywords: ['技術', '詳細', '仕様', '実装', 'アーキテクチャ', '開発'] },
    { name: '将来の展望', keywords: ['将来', '展望', '予測', '未来', 'トレンド', '発展'] },
  ];
  
  const aspectScores = aspects.map(aspect => {
    let score = 0;
    results.forEach(r => {
      const text = (`${r.title} ${r.snippet}`).toLowerCase();
      const matchingKeywords = aspect.keywords.filter(keyword => text.includes(keyword));
      if (matchingKeywords.length > 0) {
        score += matchingKeywords.length / aspect.keywords.length;
      }
    });
    return {
      name: aspect.name,
      score: Math.min(score / results.length, 1)
    };
  });
  
  // スコアが0.5未満の側面を不足情報とする
  const missingInfo = aspectScores
    .filter(a => a.score < 0.5)
    .map(a => a.name);
  
  return { missingInfo, aspectScores };
}

/**
 * キーワードと不足情報から追加クエリを生成するヘルパー関数
 */
function generateFollowUpQueries(originalQuery: string, keywords: string[], missingInfo: string[]): string[] {
  const queries = [];
  
  // 基本クエリ（元のクエリ + 定義と基本概念）
  if (missingInfo.includes('定義と基本概念')) {
    queries.push(`${originalQuery} 定義 基本概念 とは`);
  }
  
  // 事例クエリ（元のクエリ + 具体的な事例）
  if (missingInfo.includes('具体的な事例')) {
    queries.push(`${originalQuery} 具体的な事例 実例 ケーススタディ`);
  }
  
  // 市場クエリ（元のクエリ + 市場への影響）
  if (missingInfo.includes('市場への影響')) {
    queries.push(`${originalQuery} 市場 経済 影響 ビジネス`);
  }
  
  // 技術クエリ（元のクエリ + 技術的詳細）
  if (missingInfo.includes('技術的詳細')) {
    queries.push(`${originalQuery} 技術 詳細 仕様 アーキテクチャ`);
  }
  
  // 将来クエリ（元のクエリ + 将来の展望）
  if (missingInfo.includes('将来の展望')) {
    queries.push(`${originalQuery} 将来 展望 予測 トレンド 発展`);
  }
  
  // キーワードを使った追加クエリ
  if (keywords.length > 0 && queries.length < 3) {
    const keywordQuery = `${originalQuery} ${keywords.slice(0, 3).join(' ')}`;
    if (!queries.includes(keywordQuery)) {
      queries.push(keywordQuery);
    }
  }
  
  return queries;
}
