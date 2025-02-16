import { createClient } from '@/utils/supabase/server';
import { getVotesByChatId, voteMessage } from '@/lib/db/queries';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Unauthorized: No valid user found', authError);
    return Response.json(
      { error: 'Unauthorized', details: 'Please sign in to continue.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return Response.json(
      { error: 'Bad Request', details: 'Missing chatId' },
      { status: 400 }
    );
  }

  try {
    console.log('Fetching votes for chat:', chatId);
    const votes = await getVotesByChatId({ chatId });
    
    // 投票が見つからない場合は空の配列を返す
    if (!votes || votes.length === 0) {
      console.log('No votes found for chat:', chatId);
      return Response.json([]);
    }

    return Response.json(votes);
  } catch (error) {
    console.error('Failed to get votes:', error);
    // エラーの種類に応じて適切なレスポンスを返す
    if (error instanceof Error) {
      if (error.message.includes('Database error')) {
        return Response.json(
          { 
            error: 'Database Error',
            details: error.message
          },
          { status: 500 }
        );
      }
    }
    // その他のエラーの場合は空の配列を返す
    console.log('Returning empty array due to error');
    return Response.json([]);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Unauthorized: No valid user found', authError);
    return Response.json(
      { error: 'Unauthorized', details: 'Please sign in to continue.' },
      { status: 401 }
    );
  }

  try {
    const { chatId, messageId, type } = await request.json();
    
    if (!chatId || !messageId || !type) {
      return Response.json(
        { error: 'Bad Request', details: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Processing vote:', { chatId, messageId, type });
    const result = await voteMessage({ chatId, messageId, type });
    return Response.json(result);
  } catch (error) {
    console.error('Failed to process vote:', error);
    return Response.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Failed to process vote'
      },
      { status: 500 }
    );
  }
}
