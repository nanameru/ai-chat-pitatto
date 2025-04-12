import { createClient } from '@/utils/supabase/server';
import { getMessagesByChatId } from '@/lib/db/queries';

// Edge Runtimeを使用
export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    // URLからチャットIDを取得
    const url = new URL(request.url);
    const chatId = url.searchParams.get('chatId');

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Chat ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // 認証チェック
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer',
        },
      });
    }

    // メッセージを取得
    const messages = await getMessagesByChatId({ id: chatId });

    // デバッグ用ログ
    console.log(`[API] メッセージを取得しました: chatId=${chatId}, count=${messages?.length || 0}`);

    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[API] メッセージ取得エラー:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
