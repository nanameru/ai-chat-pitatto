import type { NextRequest, } from 'next/server';

/**
 * Deep Research フィードバックAPIエンドポイント
 * ユーザーからの明確化フィードバックを処理し、ストリーミングで応答を返します
 */
export async function POST(req: NextRequest) {
  try {
    const { originalQuery, feedback } = await req.json();

    if (!originalQuery || !feedback) {
      // エラーはJSONで返す
      return new Response(
        JSON.stringify({ error: '元のクエリまたはフィードバックが指定されていません' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[API] Deep Research フィードバック受信:', { originalQuery, feedback });

    // Deep Research APIを呼び出すURLを構築
    // req.url を基準にすることで、デプロイ環境でも正しいURLになるようにする
    const deepResearchUrl = new URL('/api/deep-research', req.url);

    // /api/deep-research を呼び出す
    // fetchの第二引数に RequestInit オブジェクトを渡す
    const response = await fetch(deepResearchUrl.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 認証情報など、必要なヘッダーを引き継ぐ
            // 例: Cookieを引き継ぐ (クライアントからのリクエストに含まれている場合)
            'Cookie': req.headers.get('Cookie') || '',
            // 他に必要なヘッダーがあれば追加
        },
        body: JSON.stringify({
            query: originalQuery,
            clarificationResponse: feedback // フィードバックを渡す
        }),
        // duplex: 'half' は fetch がストリームを扱えるようにするためのオプション (Node.js v18+ で必要になる場合がある)
        // Next.js Edge Runtime では通常不要だが、念のため記述しておく (環境によって挙動が異なる可能性あり)
        // @ts-ignore remove later
        duplex: 'half'
    } as RequestInit); // 型アサーションを追加

    // /api/deep-research からのレスポンスをチェック
    if (!response.ok) {
        // エラーレスポンスの内容を読み取り、ログに出力
        const errorText = await response.text();
        console.error(`[API] Deep Research 呼び出し失敗: ${response.status} ${response.statusText}`, errorText);
        // エラーレスポンスもJSONで返す
        return new Response(
            JSON.stringify({ error: `Deep Research API呼び出しに失敗しました: ${errorText}` }),
            { status: response.status, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // レスポンスボディが存在し、ストリーム形式であることを期待
    if (response.body) {
        // Content-Type は /api/deep-research からのレスポンスヘッダーを引き継ぐ
        // Vercel AI SDK は通常 text/plain; charset=utf-8 を期待するが、
        // /api/deep-research が適切な Content-Type を設定しているはず
        const responseHeaders = new Headers(response.headers);

        // レスポンスボディ (ReadableStream) をそのまま返す
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders // 元のヘッダーを引き継ぐ
        });
    } else {
        // ボディが空の場合はエラー
        console.error('[API] Deep Research APIが空のボディを返しました');
        return new Response(
            JSON.stringify({ error: 'Deep Research APIが空のレスポンスボディを返しました' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('[API] フィードバック処理中に予期せぬエラーが発生しました:', error);
    // 予期せぬエラーもJSONで返す
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    return new Response(
      JSON.stringify({ error: `フィードバック処理中にエラーが発生しました: ${errorMessage}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET や他のメソッドが必要な場合はここに追加
