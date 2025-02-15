import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore.get(name);
          return cookie?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            await cookieStore.set(name, value, options);
          } catch (error) {
            // Handle cookie error
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            await cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            // Handle cookie error
          }
        },
      },
    }
  );

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // エラーが発生した場合やcodeがない場合は、エラーメッセージ付きでログインページにリダイレクト
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', request.url));
} 