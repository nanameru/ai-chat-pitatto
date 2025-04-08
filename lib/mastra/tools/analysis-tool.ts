import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * 分析ツール - 検索結果を分析し、不足情報を特定する
 * 
 * このツールは、検索結果を分析して、ユーザーの質問に対して
 * 不足している情報や追加調査が必要な点を特定します。
 */
export const analysisTool = createTool({
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
    const isSufficient = completenessScore >= 8; // 8点以上で十分と判断
    
    console.log(`情報の十分さ評価: ${completenessScore}/10 - ${isSufficient ? '十分' : '不十分'}`);
    
    // 十分な情報がある場合は追加クエリなし
    if (isSufficient) {
      console.log(`情報が十分です (スコア: ${completenessScore}/10)。検索を終了します。`);
      return {
        originalQuery: query,
        completenessScore,
        missingInformation: [],
        followUpQueries: [],
        isSufficient: true,
        iteration: iteration,
        maxIterations: maxIterations,
        analysisTimestamp: new Date().toISOString(),
      };
    }
    
    // 不十分な場合は不足情報を特定
    const { missingInfo, aspectScores } = identifyMissingInformation(results, query);
    console.log(`不足情報: ${missingInfo.join(', ')}`);
    
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

- 不足している情報: ${missingInfo.length > 0 ? missingInfo.join(', ') : 'なし'}`;

    // 次の検索クエリを生成
    let nextQueryReason = '';
    
    // フォローアップクエリの生成
    const allFollowUpQueries = generateFollowUpQueries(query, keywords, missingInfo);
    const nextQuery = allFollowUpQueries.length > 0 ? [allFollowUpQueries[0]] : [];
    
    if (missingInfo.length > 0) {
      // 最もスコアが低い側面を特定
      const lowestScoringAspect = aspectScores
        .filter(a => missingInfo.includes(a.name))
        .sort((a, b) => a.score - b.score)[0];
      
      if (lowestScoringAspect) {
        nextQueryReason = `「${lowestScoringAspect.name}」に関する情報が不足しているため、この側面に焦点を当てた検索を行います。`;
      } else {
        nextQueryReason = `${missingInfo[0]}に関する情報が不足しているため、この側面に焦点を当てた検索を行います。`;
      }
    } else if (criteriaDetails.detailLevel.score < 1.5) {
      nextQueryReason = `検索結果の詳細度が不足しているため、より詳細な情報を収集する検索を行います。`;
    } else if (criteriaDetails.diversityOfSources.score < 1.5) {
      nextQueryReason = `情報源の多様性が不足しているため、異なる視点や比較情報を収集する検索を行います。`;
    } else {
      nextQueryReason = `より多様な情報を収集するための検索を行います。`;
    }
    
    console.log(`情報が不十分です (スコア: ${completenessScore}/10)。次の検索クエリ: ${nextQuery.join(', ')}`);
    console.log(`次のクエリの理由: ${nextQueryReason}`);
    
    return {
      originalQuery: query,
      completenessScore,
      missingInformation: missingInfo,
      followUpQueries: nextQuery,
      nextQueryReason,
      analysisText,
      criteriaDetails: Object.entries(criteriaDetails).map(([key, value]) => ({
        name: value.description,
        score: value.score,
        max: value.max
      })),
      aspectScores,
      isSufficient: false,
      iteration: iteration + 1,
      maxIterations: maxIterations,
      analysisTimestamp: new Date().toISOString(),
    };
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
    const text = `${r.title} ${r.snippet}`.toLowerCase();
    return queryTerms.filter(term => text.includes(term)).length / queryTerms.length;
  });
  criteria.contentRelevance.score = Math.min((relevanceScores.reduce((a, b) => a + b, 0) / results.length) * 2, 2);
  
  // 情報源の多様性（0-2点）
  const uniqueDomains = new Set(results.map(r => {
    try {
      return new URL(r.url).hostname;
    } catch (e) {
      return r.url;
    }
  }));
  criteria.diversityOfSources.score = Math.min(uniqueDomains.size / 3, 2);
  
  // 詳細度（0-2点）
  const avgSnippetLength = results.reduce((sum, r) => sum + r.snippet.length, 0) / results.length;
  criteria.detailLevel.score = Math.min(avgSnippetLength / 100, 2);
  
  // 側面のカバレッジ（0-2点）
  const aspects = ['定義', '例', '事例', '影響', 'トレンド', '将来', '技術'];
  const aspectsCovered = aspects.filter(aspect => 
    results.some(r => `${r.title} ${r.snippet}`.toLowerCase().includes(aspect.toLowerCase()))
  );
  criteria.coverageOfAspects.score = Math.min(aspectsCovered.length / 3, 2);
  
  // 総合スコア（10点満点）
  const totalScore = Object.values(criteria).reduce((a, b) => a + b.score, 0);
  
  console.log(`評価スコア: ${totalScore.toFixed(1)}/10 (結果数: ${criteria.resultCount.score.toFixed(1)}, 関連性: ${criteria.contentRelevance.score.toFixed(1)}, 多様性: ${criteria.diversityOfSources.score.toFixed(1)}, 詳細度: ${criteria.detailLevel.score.toFixed(1)}, カバレッジ: ${criteria.coverageOfAspects.score.toFixed(1)})`);
  
  return {
    score: Math.round(totalScore),
    criteriaDetails: criteria
  };
}

/**
 * 不足している情報を特定する関数
 */
function identifyMissingInformation(results: any[], query: string): { missingInfo: string[], aspectScores: { name: string, score: number }[] } {
  const missingAspects: string[] = [];
  
  // 主要な側面のリスト
  const keyAspects = [
    { name: '定義と基本概念', keywords: ['定義', 'とは', '概念', '基本', '意味'], score: 0 },
    { name: '具体的な事例', keywords: ['事例', '例', 'ケース', '実例', '実践'], score: 0 },
    { name: '市場への影響', keywords: ['市場', '影響', '効果', 'インパクト', '経済'], score: 0 },
    { name: '技術的詳細', keywords: ['技術', '仕組み', 'メカニズム', '方法', '手法'], score: 0 },
    { name: '将来の展望', keywords: ['将来', '展望', 'トレンド', '予測', '未来'], score: 0 },
  ];
  
  // 各側面のカバレッジを評価
  for (const aspect of keyAspects) {
    // 各キーワードが検索結果に含まれる度合いを計算
    const keywordMatches = aspect.keywords.map(keyword => {
      const matchCount = results.filter(r => 
        `${r.title} ${r.snippet}`.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      return { keyword, matchCount };
    });
    
    // 側面のスコアを計算 (0-1の範囲)
    aspect.score = Math.min(
      keywordMatches.reduce((sum, { matchCount }) => sum + Math.min(matchCount / 2, 1), 0) / aspect.keywords.length,
      1
    );
    
    // スコアが0.5未満の場合、不足している側面として追加
    if (aspect.score < 0.5) {
      missingAspects.push(aspect.name);
    }
  }
  
  // 各側面のスコアを返す
  const aspectScores = keyAspects.map(a => ({ name: a.name, score: a.score }));
  const missingInfo = missingAspects.length > 0 ? missingAspects : ['より詳細な情報'];
  
  return { missingInfo, aspectScores };
}

/**
 * キーワードと不足情報から追加クエリを生成するヘルパー関数
 */
function generateFollowUpQueries(originalQuery: string, keywords: string[], missingInfo: string[]): string[] {
  const queries: string[] = [];
  
  // 不足している情報に基づいてクエリを生成
  missingInfo.forEach(info => {
    switch (info) {
      case '定義と基本概念':
        queries.push(`${originalQuery} 定義 基本概念 とは`);
        break;
      case '具体的な事例':
        queries.push(`${originalQuery} 具体的な事例 実例 ケーススタディ`);
        break;
      case '市場への影響':
        queries.push(`${originalQuery} 市場影響 経済効果 インパクト`);
        break;
      case '技術的詳細':
        queries.push(`${originalQuery} 技術 仕組み 実装方法`);
        break;
      case '将来の展望':
        queries.push(`${originalQuery} 将来 展望 トレンド 予測`);
        break;
      default:
        queries.push(`${originalQuery} ${info}`);
    }
  });
  
  // 元のクエリにキーワードを組み合わせたクエリ
  if (keywords.length > 0 && queries.length < 3) {
    queries.push(`${originalQuery} ${keywords[0]}`);
  }
  
  // 日本語のクエリの場合は英語でも検索（クエリが少ない場合のみ）
  if (queries.length < 2 && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(originalQuery)) {
    // 日本語が含まれている場合、英語でも検索
    const englishQuery = originalQuery
      .replace(/2025\u5e74/g, '2025')
      .replace(/\u6700\u65b0/g, 'latest')
      .replace(/AI\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8/g, 'AI agents')
      .replace(/\u306b\u3064\u3044\u3066\u6559\u3048\u3066/g, '');
    
    queries.push(`${englishQuery} latest developments`);
  }
  
  return queries.filter((q, i, self) => self.indexOf(q) === i); // 重複除去
}
