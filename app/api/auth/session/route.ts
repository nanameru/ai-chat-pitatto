import { createClient } from '@/utils/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return new Response(
      JSON.stringify({ error: 'No session found' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return new Response(
    JSON.stringify(session),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
