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
      return Response.json(
        { 
          error: 'Database Error',
          details: error.message
        },
        { status: 500 }
      );
    }
    return Response.json([]);
  }
}

export async function PATCH(request: Request) {
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
    const body = await request.json();
    console.log('Request body:', body);

    const { chatId, messageId, type } = body;

    if (!chatId || !messageId || !type) {
      return Response.json(
        { error: 'Bad Request', details: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (type !== 'up' && type !== 'down') {
      return Response.json(
        { error: 'Bad Request', details: 'Invalid vote type' },
        { status: 400 }
      );
    }

    console.log('Voting message:', { chatId, messageId, type, userId: user.id });
    await voteMessage({
      chatId,
      messageId,
      type,
    });

    const votes = await getVotesByChatId({ chatId });
    console.log('Updated votes:', votes);
    return Response.json(votes);
  } catch (error) {
    console.error('Failed to vote message:', error);
    return Response.json(
      { 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Failed to vote message'
      },
      { status: 500 }
    );
  }
}