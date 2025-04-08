/**
 * X検索APIエンドポイント
 */

import { type NextRequest, NextResponse } from 'next/server';
import { XSearchService } from '@/lib/ai/x-search';
import type { XSearchState } from '@/lib/ai/x-search/types';

/**
 * X検索APIのPOSTハンドラ
 * @param req リクエスト
 * @returns レスポンス
 */
export async function POST(req: NextRequest) {
  try {
    // リクエストボディを取得
    const body = await req.json();
    const { query, chatId } = body;
    
    // バリデーション
    if (!query) {
      return NextResponse.json(
        { error: 'クエリが指定されていません' },
        { status: 400 }
      );
    }
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'チャットIDが指定されていません' },
        { status: 400 }
      );
    }
    
    console.log(`[X-Search API] Received search request: ${query} for chat ${chatId}`);
    
    // X検索サービスを初期化
    const xSearchService = new XSearchService();
    
    // 検索を実行
    const result = await xSearchService.executeSearch(query, chatId);
    
    // 結果を返す
    return NextResponse.json(result);
  } catch (error) {
    console.error('[X-Search API] Error processing request:', error);
    
    return NextResponse.json(
      { error: `検索処理中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    );
  }
}

/**
 * ストリーミングレスポンスを返すPOSTハンドラ（実装例）
 * 注意: この実装はNext.jsのストリーミングレスポンスAPIに依存します
 */
export async function POST_streaming(req: NextRequest) {
  try {
    // リクエストボディを取得
    const body = await req.json();
    const { query, chatId } = body;
    
    // バリデーション
    if (!query || !chatId) {
      return NextResponse.json(
        { error: 'クエリまたはチャットIDが指定されていません' },
        { status: 400 }
      );
    }
    
    // ストリーミングレスポンスを作成
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // 状態変更時のコールバック関数
    const onStateChange = async (state: XSearchState, data?: any) => {
      await writer.write(
        encoder.encode(
          `${JSON.stringify({ type: 'state_update', state, data })}\n`
        )
      );
    };
    
    // バックグラウンドで検索を実行
    const xSearchService = new XSearchService();
    
    // 非同期で検索を実行し、結果をストリーミング
    (async () => {
      try {
        const result = await xSearchService.executeSearch(query, chatId, onStateChange);
        
        // 最終結果を送信
        await writer.write(
          encoder.encode(
            `${JSON.stringify({ type: 'result', data: result })}\n`
          )
        );
      } catch (error) {
        // エラーを送信
        await writer.write(
          encoder.encode(
            `${JSON.stringify({ 
              type: 'error', 
              error: error instanceof Error ? error.message : '不明なエラー' 
            })}\n`
          )
        );
      } finally {
        await writer.close();
      }
    })();
    
    // ストリーミングレスポンスを返す
    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('[X-Search API] Error setting up streaming:', error);
    
    return NextResponse.json(
      { error: `ストリーミング設定中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    );
  }
}
