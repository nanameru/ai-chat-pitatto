import { createClient } from '@/utils/supabase/server';
import { getVotesByChatId, voteMessage } from '@/lib/db/queries';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response('Missing chatId', { status: 400 });
  }

  try {
    const votes = await getVotesByChatId({ id: chatId });
    return Response.json(votes);
  } catch (error) {
    console.error('Failed to get votes:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { chatId, messageId, type } = await request.json();

    if (!chatId || !messageId || !type) {
      return new Response('Missing required fields', { status: 400 });
    }

    await voteMessage({ chatId, messageId, type });
    return new Response('OK');
  } catch (error) {
    console.error('Failed to vote message:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
