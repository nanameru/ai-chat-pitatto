import { NextResponse } from 'next/server';
import { mastra } from '@/lib/mastra';

// Edge Runtimeを使用
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // リクエストボディの解析
    const body = await request.json();
    const { query, mode = 'agent' } = body;
    
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
      const response = await mastra.getAgent('deepResearchAgent').generate(messages);
      
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
