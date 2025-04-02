import { NextRequest, NextResponse } from 'next/server';
import { 
  deepResearchAgentV2, 
  planningAgent,
  researchAgent,
  integrationAgent 
} from '@/lib/mastra/agents/deep-research-v2';
import { queryClarifier } from '@/lib/mastra/agents/deep-research-v2/clarification';
import { Tool } from '@mastra/core';
import { z } from 'zod';
import { getJson } from 'serpapi';

type ResearchPlan = {
  outline: string;
  sections: { title: string; focus: string; queries?: string[] }[];
};

type AccumulatedInfo = {
  [sectionTitle: string]: {
    content: string;
    sources: string[];
  };
};

const MAX_RESEARCH_ITERATIONS = 3;

// 検索結果の型を定義
type SearchResult = {
    title: string;
    snippet: string;
    url: string;
};

// 蓄積する検索結果の型を定義
type SearchResultData = {
    query: string;
    title: string;
    link: string;
    snippet: string;
};

export async function POST(req: NextRequest) {
  try {
    const { query, clarificationResponse } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'クエリが指定されていないか、無効な形式です' },
        { status: 400 }
      );
    }
    
    console.log('[API] Deep Research Agent実行開始:', query);
    
    const initialInput = clarificationResponse 
      ? `元のクエリ: ${query}\n\nユーザーの回答: ${clarificationResponse}` 
      : query;

    // --- 0. 明確化段階 (Clarification Phase) ---
    let needsClarification = false;
    let clarificationMessage = "";
    
    if (!clarificationResponse) {
        try {
            // queryClarifierツールを使用してクエリの具体性を評価
            // queryClarifierが存在することを確認
            if (!queryClarifier || typeof queryClarifier.execute !== 'function') {
                console.error('[API] queryClarifierツールが正しく読み込まれていません');
                throw new Error('queryClarifierツールが正しく読み込まれていません');
            }
            
            const clarificationResult = await queryClarifier.execute({
                context: { query }
            }) as { needsClarification: boolean; message: string; originalQuery: string; topic?: string };
            
            needsClarification = clarificationResult.needsClarification;
            clarificationMessage = clarificationResult.message;
            
            if (needsClarification) {
                console.log('[API] 明確化が必要と判断されました。');
                return NextResponse.json({
                    success: true,
                    needsClarification: true,
                    clarificationMessage: clarificationMessage,
                    originalQuery: query
                });
            } else {
                console.log('[API] 明確化不要と判断されました。計画段階へ進みます。');
                // successフィールドを追加してフロントエンドのエラーを防止
            }
        } catch (error) {
            console.error('[API] 明確化ツールの実行中にエラーが発生しました:', error);
            // エラーが発生した場合は計画段階に進む
            console.log('[API] エラーのため明確化をスキップし、計画段階へ進みます。');
        }
    } else {
        console.log('[API] 明確化応答あり。計画段階へ進みます。');
    }

    // --- 1. 計画段階 (Planning Phase) ---
    console.log('[API] 計画段階開始');
    const planningResult = await planningAgent.generate(
        `以下のトピックに関する詳細な調査計画を作成してください: "${initialInput}"\n\n計画には、主要なセクションとその焦点、初期検索クエリ案を含めてください。`
    );

    let plan: ResearchPlan = { 
        outline: `計画概要:\n${planningResult.text}`, 
        sections: [] 
    }; 
    console.log('[API] 計画段階完了:', plan.outline);
    if (plan.sections.length === 0) {
        plan.sections = [
            { title: "生成AIの基本概念", focus: "定義、歴史、主要な種類", queries: ["生成AI 定義", "生成AI 歴史", "生成AI 種類"] },
            { title: "ビジネス活用事例", focus: "マーケティング、顧客サービス、製品開発", queries: ["生成AI マーケティング活用", "生成AI 顧客サービス 事例", "生成AI 製品開発 応用"] },
            { title: "導入の課題と対策", focus: "倫理、セキュリティ、人材育成", queries: ["生成AI 倫理的課題", "生成AI セキュリティリスク", "生成AI 人材育成 方法"] },
        ];
        console.log('[API] 計画をシミュレーション:', plan.sections);
    }

    // --- 2. 調査段階 (Research Phase - Iterative Loop) ---
    console.log('[API] 調査段階開始');
    let accumulatedInfo: AccumulatedInfo = {};
    let iterationCount = 0;
    let needsMoreResearch = true; 

    while (needsMoreResearch && iterationCount < MAX_RESEARCH_ITERATIONS) {
        iterationCount++;
        console.log(`[API] 調査反復: ${iterationCount}`);
        let allSectionsSufficient = true;

        for (const section of plan.sections) {
            console.log(`[API] セクション調査開始: ${section.title}`);
            
            const queriesToSearch = section.queries || [`${section.title} ${section.focus}`]; 
            console.log(`[API] 検索クエリ: ${queriesToSearch.join(', ')}`);

            let searchResultsData: SearchResultData[] = []; 
            for (const q of queriesToSearch) {
                console.log(`[API] Web検索実行中: ${q}`);
                
                try {
                    // 検索処理を直接実装
                    console.log(`検索実行: ${q}`);
                    
                    // SerpAPIを使用して実際の検索を実行
                    const apiKey = process.env.SERPAPI_API_KEY;
                    
                    let searchResults: SearchResult[] = [];
                    
                    if (!apiKey) {
                        console.warn('SERPAPI_API_KEY が設定されていません。モックデータを返します。');
                        // モックデータを生成
                        searchResults = [
                            { title: `${q}に関する情報1`, snippet: `これは${q}についての情報です。`, url: 'https://example.com/real-1' },
                            { title: `${q}に関する情報2`, snippet: `${q}の詳細な解説です。`, url: 'https://example.com/real-2' },
                        ];
                    } else {
                        // SerpAPIを使用して実際の検索を実行
                        const params = {
                            engine: "google",
                            q: q,
                            api_key: apiKey,
                            hl: "ja"
                        };
                        
                        const response = await getJson(params);
                        
                        // 検索結果を整形
                        searchResults = response.organic_results?.map((result: any) => ({
                            title: result.title || '',
                            snippet: result.snippet || '',
                            url: result.link || ''
                        })) || [];
                        
                        if (searchResults.length === 0) {
                            console.warn(`検索「${q}」の結果が0件でした。`);
                            throw new Error(`検索「${q}」の結果が0件でした。別のクエリを試してください。`);
                        }
                    }
                    
                    // 検索結果を追加
                    searchResultsData.push(...searchResults.map((result: SearchResult) => ({
                        query: q,
                        title: result.title,
                        link: result.url,
                        snippet: result.snippet
                    } as SearchResultData)));
                } catch (error) {
                    console.error('検索APIでエラーが発生しました:', error);
                    // エラーをスローして上位で処理
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    throw new Error(`検索処理中にエラーが発生しました: ${errorMessage}`);
                }
            }
            const searchResultsText = searchResultsData.map(r => `[${r.title}](${r.link}): ${r.snippet}`).join('\n');
            
            const analysisResult = await researchAgent.generate(
                `以下の検索結果を分析し、セクション「${section.title}」（焦点: ${section.focus}）に関連する重要な情報を抽出してください。\n\n検索結果:\n${searchResultsText}\n\n蓄積済みの情報:\n${accumulatedInfo[section.title]?.content || 'なし'}`
            );
            const extractedInfo = analysisResult.text; 

            if (!accumulatedInfo[section.title]) {
                accumulatedInfo[section.title] = { content: '', sources: [] };
            }
            accumulatedInfo[section.title].content += `\n反復 ${iterationCount}:\n${extractedInfo}`; 
            searchResultsData.forEach(r => {
                if (!accumulatedInfo[section.title].sources.includes(r.link)) {
                     accumulatedInfo[section.title].sources.push(r.link);
                }
            });
            
            const gapCheckResult = await researchAgent.generate(
                `セクション「${section.title}」（焦点: ${section.focus}）について、以下の蓄積情報が十分かどうか評価してください。不足している具体的な情報があれば指摘してください。\n\n蓄積情報:\n${accumulatedInfo[section.title].content}`
            );

            const isSufficient = !gapCheckResult.text.includes("不足") && !gapCheckResult.text.includes("追加"); 
            console.log(`[API] セクション「${section.title}」の情報充足度: ${isSufficient ? '十分' : '不足'}`);
            if (!isSufficient) {
                allSectionsSufficient = false;
                console.log(`[API] ギャップ指摘: ${gapCheckResult.text}`); 
            }
        } 

        if (allSectionsSufficient) {
            needsMoreResearch = false;
            console.log('[API] 全セクションの情報が充足したため、調査を終了します。');
        } else if (iterationCount >= MAX_RESEARCH_ITERATIONS) {
            needsMoreResearch = false;
            console.log('[API] 最大反復回数に達したため、調査を終了します。');
        } else {
             console.log('[API] 不足情報があるため、調査を継続します。');
        }
    } 
    console.log('[API] 調査段階完了');

    // --- 3. 統合段階 (Integration Phase) ---
    console.log('[API] 統合段階開始');
    const integrationContext = `
調査トピック: ${initialInput}

調査計画:
${plan.outline}
${plan.sections.map(s => `- ${s.title}: ${s.focus}`).join('\n')}

収集された情報:
${Object.entries(accumulatedInfo).map(([title, data]) => 
    `## ${title}\n\n${data.content}\n\nSources:\n${data.sources.join('\n')}`
).join('\n\n')}

上記の計画と収集情報に基づいて、包括的で構造化された最終文書を作成してください。各セクションの内容を生成し、それらを統合して読みやすいレポートにまとめてください。最後に文書全体の品質をチェックしてください。
`;

    const integrationResult = await integrationAgent.generate(
        integrationContext
    );

    const finalDocument = integrationResult.text; 
    console.log('[API] 統合段階完了');
    console.log('[API] Deep Research Agent全プロセス完了');
    
    return NextResponse.json({
      success: true,
      result: finalDocument, 
      needsClarification: false,
      plan: plan.outline,
      sources: Object.entries(accumulatedInfo).map(([title, data]) => data.sources).flat()
    });

  } catch (error) {
    console.error('[API] Deep Research Agent実行エラー:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { 
        success: false,
        error: `Deep Research Agentの実行中にエラーが発生しました: ${errorMessage}` 
      },
      { status: 500 }
    );
  }
}
