import { NextRequest, NextResponse } from 'next/server';

/**
 * Deep Research フィードバックAPIエンドポイント
 * ユーザーからの明確化フィードバックを処理します
 */
export async function POST(req: NextRequest) {
  try {
    const { originalQuery, feedback } = await req.json();
    
    if (!originalQuery || !feedback) {
      return NextResponse.json(
        { error: '元のクエリまたはフィードバックが指定されていません' },
        { status: 400 }
      );
    }
    
    console.log('[API] Deep Research フィードバック受信:', { originalQuery, feedback });
    
    // フィードバックを受け取り、Deep Researchプロセスを再開
    // リダイレクト先のURLを構築
    const redirectUrl = `/api/deep-research`;
    
    // POSTリクエストのボディを準備
    const body = JSON.stringify({
      query: originalQuery,
      clarificationResponse: feedback
    });
    
    // Deep Research APIを呼び出す
    const response = await fetch(new URL(redirectUrl, req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body
    });
    
    // レスポンスを返す
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[API] フィードバック処理中にエラーが発生しました:', error);
    return NextResponse.json(
      { error: 'フィードバック処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
