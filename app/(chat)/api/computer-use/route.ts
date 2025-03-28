import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createClient } from '@/utils/supabase/server';
// TODO: @ai-sdk/anthropicのインストールに問題があるため、一時的にコメントアウト
// import { anthropicProvider } from '@/lib/ai/models';
// import { bashTool, textEditorTool, computerTool } from '@/lib/ai/computer-use/tools';

// Edge Runtimeを使用
export const runtime = 'edge';

export async function POST(request: NextRequest): Promise<Response> {
  console.log('Received computer-use POST request');
  const requestStartTime = Date.now();
  
  try {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      console.error('Unauthorized: No valid user found', authError);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          details: 'Please sign in to continue.'
        }),
        { status: 401 }
      );
    }

    // リクエストボディの解析
    const { messages, model } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request', 
          details: 'Messages array is required and must not be empty.'
        }),
        { status: 400 }
      );
    }

    // TODO: @ai-sdk/anthropicのインストールに問題があるため、一時的に無効化
    return new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        details: 'Computer Use functionality is temporarily disabled due to dependency installation issues with @ai-sdk/anthropic.',
        message: 'Please try again later after the dependency is successfully installed.'
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    console.error('Error in computer-use API:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: errorMessage
      }),
      { status: 500 }
    );
  } finally {
    const requestDuration = Date.now() - requestStartTime;
    console.log(`Computer-use API request completed in ${requestDuration}ms`);
  }
}
