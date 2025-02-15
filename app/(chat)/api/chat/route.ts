import { streamText, createDataStream } from 'ai';
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';

import { createClient } from '@/utils/supabase/server';
import { myProvider } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  saveChat,
  saveMessages,
  getMessagesByChatId,
  deleteMessagesByChatIdAfterTimestamp,
} from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const json = await request.json();
  const { messages, chatId, model } = json;
  const userId = session.user.id;

  try {
    const chatTitle = messages[0].content.substring(0, 100);
    const id = chatId ?? nanoid();

    if (!chatId) {
      await saveChat({
        id,
        userId,
        title: chatTitle,
      });
    }

    const cookieStore = cookies();
    const chatModelFromCookie = cookieStore.get('chat-model');
    const selectedModel = model ?? chatModelFromCookie?.value ?? 'gpt-3.5-turbo';

    const { stream, data } = await createDataStream();

    const completion = await streamText({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      model: selectedModel,
      stream: true,
      onCompletion: async (completion) => {
        await saveMessages({
          messages: [{
            id: nanoid(),
            chatId: id,
            role: 'assistant',
            content: completion,
            createdAt: new Date(),
          }],
        });
      },
    });

    completion.pipeTo(stream);

    return new Response(data, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Failed to process chat:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const timestamp = searchParams.get('timestamp');

    if (!chatId || !timestamp) {
      return new Response('Missing required parameters', { status: 400 });
    }

    await deleteMessagesByChatIdAfterTimestamp({
      chatId,
      timestamp: new Date(timestamp),
    });

    const messages = await getMessagesByChatId({ id: chatId });
    return Response.json(convertToUIMessages(messages));
  } catch (error) {
    console.error('Failed to delete messages:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
