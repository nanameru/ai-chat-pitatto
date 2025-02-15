import { createClient } from '@/utils/supabase/server';
import { getChatsByUserId } from '@/lib/db/queries';

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chats = await getChatsByUserId({ id: session.user.id });
    return Response.json(chats);
  } catch (error) {
    console.error('Failed to get chat history:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
