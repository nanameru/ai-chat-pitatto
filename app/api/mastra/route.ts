import { NextResponse } from 'next/server';
import { mastra } from '@/lib/mastra';

// Node.jsランタイムを使用
export const runtime = 'nodejs';

// タイムアウトを120秒に設定
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    // リクエストボディの解析
    const body = await request.json();
    const { query, mode = 'agent' } = body;
    
    console.log(`Mastra API called with query: "${query}"`);
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    // モードに応じてエージェントまたはワークフローを実行
    if (mode === 'agent') {
      // エージェントモード
      const messages = [{ role: 'user', content: query }];
      console.log(`Executing deepResearchAgent with query: "${query}"`);
      console.log(`\n===== 反復連鎖検索の詳細フロー開始 =====`);
      
      // ツール実行のログを詳細に出力するためのオプション
      const response = await mastra.getAgent('deepResearchAgent').generate(messages, {
        onToolCall: (toolCall: { name: string; input: any }) => {
          console.log(`\n[ツール実行] ${toolCall.name}`);
          console.log(`入力: ${JSON.stringify(toolCall.input, null, 2)}`);
          
          if (toolCall.name === 'searchTool' && toolCall.input.query) {
            console.log(`検索実行: ${toolCall.input.query}`);
            console.log(`検索ツールが呼び出されました - ${new Date().toISOString()}`);
          } else if (toolCall.name === 'analysisTool') {
            if (toolCall.input.iteration) {
              console.log(`分析実行: ${toolCall.input.query}の検索結果を分析 (反復回数: ${toolCall.input.iteration}/${toolCall.input.maxIterations || 10})`);
            } else {
              console.log(`分析実行: ${toolCall.input.query}の検索結果を分析`);
            }
          }
        },
        onToolResult: (toolCall: { name: string; input: any }, result: any) => {
          console.log(`[ツール結果] ${toolCall.name}`);
          if (toolCall.name === 'searchTool') {
            console.log(`検索クエリ: "${toolCall.input.query}"`);
            if (result?.results) {
              console.log(`結果件数: ${result.results.length}件`);
              if (result.results.length > 0) {
                console.log(`最初の3件: ${result.results.slice(0, 3).map((r: any) => r.title).join(', ')}`);
              }
            }
          } else if (toolCall.name === 'analysisTool') {
            if (result.completenessScore !== undefined) {
              console.log(`情報の十分さスコア: ${result.completenessScore}/10 - ${result.isSufficient ? '十分' : '不十分'}`);
              
              if (result.missingInformation && result.missingInformation.length > 0) {
                console.log(`不足情報: ${result.missingInformation.join(', ')}`);
              }
              
              if (result.followUpQueries && result.followUpQueries.length > 0) {
                console.log(`次の検索クエリ: ${result.followUpQueries.join(', ')}`);
              } else if (result.isSufficient) {
                console.log(`情報が十分なため、検索を終了します。`);
              }
            } else {
              console.log(`分析結果: ${JSON.stringify(result, null, 2)}`);
            }
          }
        }
      });
      
      console.log(`\n===== 反復連鎖検索の詳細フロー終了 =====`);
      console.log(`Agent response received, length: ${response.text?.length || 0} characters`);
      
      return NextResponse.json({
        result: response.text,
        agent: 'Deep Research Agent',
      });
    } else if (mode === 'workflow') {
      // ワークフローモード
      const { runId, start } = mastra.getWorkflow('researchWorkflow').createRun();
      const runResult = await start({
        triggerData: { query },
      });
      
      return NextResponse.json({
        result: runResult.results.resultIntegration.summary,
        runId,
        workflow: 'Deep Research Workflow',
        details: runResult.results,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use "agent" or "workflow"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// GETメソッドも実装（ステータスチェック用）
export async function GET() {
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'Mastra API is running',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
