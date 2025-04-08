import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { myProvider } from '@/lib/ai/models';
import { saveMessages } from '@/lib/db/queries';
import { createDocument } from '@/lib/ai/tools/create-document';
import { mastra } from '@/lib/mastra';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { Message as DBMessage } from '@/lib/db/schema';

const MESSAGE_SIZE_LIMIT = 1024 * 1024; // 1MB

export const runtime = 'edge'

// Deep Research API route - standardized to match normal chat mode behavior
export async function POST(request: Request): Promise<Response> {
  console.log('[API Deep Research] Received POST request');
  
  try {
    // Supabase client initialization
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development mode handling for authentication
    const isDevelopment = process.env.NODE_ENV === 'development';
    const userId = isDevelopment && (!user || authError) 
      ? 'test-user-id-for-development' 
      : user?.id;

    // Authentication check (bypassed in development)
    if (!isDevelopment && (authError || !user?.id)) {
      console.error('[API Deep Research] Unauthorized: No valid user found', authError);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          details: 'Please sign in to continue.'
        }),
        { 
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer',
            'X-Error': 'true',
            'X-Error-Type': 'Unauthorized'
          }
        }
      );
    }

    // Parse request body
    const json = await request.json();
    console.log('[API Deep Research] Request payload:', {
      messagesCount: json.messages?.length,
      chatId: json.chatId,
      model: json.model,
      query: json.query
    });
    
    // Extract data from request
    const { messages, chatId, model, query, clarificationResponse } = json;
    
    // Validate chatId
    if (!chatId) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: 'Chat ID is required'
        }),
        { 
          status: 400,
          headers: {
            'X-Error': 'true',
            'X-Error-Type': 'InvalidInput'
          }
        }
      );
    }

    // Ensure user exists in database (for non-development)
    if (!isDevelopment) {
      const { data: existingUser } = await supabase
        .from('User')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!existingUser) {
        const { error: createUserError } = await supabase
          .from('User')
          .insert([{ 
            id: userId,
            email: user?.email || 'no-email'
          }]);

        if (createUserError) {
          console.error('[API Deep Research] Failed to create user:', createUserError);
          return new Response(
            JSON.stringify({ 
              error: 'User creation failed', 
              details: 'Failed to create user record' 
            }),
            { 
              status: 500,
              headers: {
                'X-Error': 'true',
                'X-Error-Type': 'UserCreationFailed'
              }
            }
          );
        }
      }
    }

    // Validate messages
    const typedMessages = messages || [];
    if (!Array.isArray(typedMessages)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: 'Messages must be an array'
        }),
        { 
          status: 400,
          headers: {
            'X-Error': 'true',
            'X-Error-Type': 'InvalidInput'
          }
        }
      );
    }

    // Check message size limit
    const messageSize = JSON.stringify(typedMessages).length;
    if (messageSize > MESSAGE_SIZE_LIMIT) {
      return new Response(
        JSON.stringify({ 
          error: 'Message size limit exceeded', 
          details: `Message size (${messageSize} bytes) exceeds limit (${MESSAGE_SIZE_LIMIT} bytes)`
        }),
        { 
          status: 413,
          headers: {
            'X-Error': 'true',
            'X-Error-Type': 'MessageSizeLimitExceeded'
          }
        }
      );
    }

    // Extract user query from messages or use provided query
    const userQueryFromMessages = typedMessages.filter(msg => msg.role === 'user').pop();
    const userQueryContent = typeof userQueryFromMessages?.content === 'string' 
      ? userQueryFromMessages.content 
      : (typeof userQueryFromMessages?.content === 'object' && userQueryFromMessages?.content?.text 
        ? userQueryFromMessages.content.text 
        : '');
    
    // Use provided query or extract from messages
    const userQuery = query || userQueryContent;
    
    if (!userQuery) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: 'User query is required'
        }),
        { 
          status: 400,
          headers: {
            'X-Error': 'true',
            'X-Error-Type': 'InvalidInput'
          }
        }
      );
    }

    // Generate chat title from user query
    let chatTitle = 'New Deep Research Chat';
    if (userQuery) {
      chatTitle = userQuery.substring(0, 100) || 'New Deep Research Chat';
    }

    const timestamp = new Date().toISOString();

    // Check if chat exists and create/update as needed
    const { data: existingChat, error: getChatError } = await supabase
      .from('Chat')
      .select('*')
      .eq('id', chatId)
      .maybeSingle();

    if (getChatError && getChatError.code !== 'PGRST116') {
      console.error('[API Deep Research] Failed to get existing chat:', getChatError);
      throw new Error(`Failed to get existing chat: ${getChatError.message}`);
    }

    // Create new chat if it doesn't exist
    if (!existingChat) {
      console.log('[API Deep Research] Creating new chat:', { chatId, title: chatTitle, userId });
      const { error: insertError } = await supabase
        .from('Chat')
        .insert([{
          id: chatId,
          title: chatTitle,
          userId,
          createdAt: timestamp
        }]);

      if (insertError) {
        console.error('[API Deep Research] Failed to create chat:', insertError);
        throw new Error(`Failed to create chat: ${insertError.message}`);
      }
    } else {
      // Update existing chat
      console.log('[API Deep Research] Updating existing chat:', chatId);
      const { error: updateError } = await supabase
        .from('Chat')
        .update({ updatedAt: timestamp })
        .eq('id', chatId);

      if (updateError) {
        console.error('[API Deep Research] Failed to update chat:', updateError);
        throw new Error(`Failed to update chat: ${updateError.message}`);
      }
    }

    // Save user message to database
    const userMessage: DBMessage = {
      id: nanoid(),
      chatId: chatId,
      role: 'user',
      content: {
        type: 'text',
        text: clarificationResponse 
          ? `${userQuery}\n\n明確化回答: ${clarificationResponse}`
          : userQuery
      },
      createdAt: new Date(timestamp)
    };

    // Save user message to database
    if (!isDevelopment) {
      await saveMessages({ 
        messages: [{
          id: userMessage.id,
          chatId: userMessage.chatId,
          role: userMessage.role,
          content: typeof userMessage.content === 'object' ? JSON.stringify(userMessage.content) : userMessage.content,
          createdAt: userMessage.createdAt
        }]
      });
    }

    // Deep Research system prompt
    const deepResearchPrompt = `あなたは詳細な調査と分析を行うDeep Research Assistantです。
ユーザーの質問に対して、包括的で詳細な回答を提供してください。
情報源を引用し、論理的に構造化された回答を作成してください。`;

    // Use provided model or default
    const selectedModel = model ?? 'chat-model-large';

    // Prepare messages for AI model
    const aiMessages = [
      {
        id: nanoid(),
        role: 'system' as const,
        content: deepResearchPrompt,
      },
      ...typedMessages
    ];

    // Format messages for the model
    const modelMessages = aiMessages.map((msg: any) => {
      const baseContent = typeof msg.content === 'string' 
        ? msg.content
        : (typeof msg.content === 'object' && msg.content?.text 
          ? msg.content.text 
          : msg.content);

      if (msg.role === 'system') {
        return {
          role: 'system' as const,
          content: baseContent as string,
        };
      } else if (msg.role === 'user') {
        return {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: baseContent as string }],
        };
      } else if (msg.role === 'assistant') {
        return {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: baseContent as string }],
        };
      }
      
      throw new Error(`Unsupported role: ${msg.role}`);
    });

    // Create streaming response using Vercel AI SDK
    return createDataStreamResponse({
      execute: async (dataStream) => {
        // Document tool for AI to create documents
        const documentTool = createDocument({
          session: { user: { id: userId } } as any,
          dataStream
        });
        
        // Stream text using Vercel AI SDK
        const result = streamText({
          model: myProvider.languageModel(selectedModel),
          system: deepResearchPrompt,
          messages: modelMessages.filter(msg => msg.role !== 'system'),
          tools: {
            createDocument: documentTool
          },
          experimental_transform: smoothStream({ chunking: 'word' }),
          onFinish: async ({ response }) => {
            try {
              // Use Mastra agent to enhance response
              const agent = mastra.getAgent('deepResearchAgent');
              const agentResult = await agent.generate(userQuery);
              
              // Check if clarification is needed
              const needsClarification = agentResult.toolCalls?.some((tc: any) => 
                tc.toolName === 'queryClarifier' || 
                (tc.type === 'tool-call' && tc.toolName === 'queryClarifier')
              );
              
              // Get response text from model or agent
              const responseText = response.messages?.[response.messages.length - 1]?.content || '';
              const finalResponseText = needsClarification 
                ? (agentResult.text || '質問の詳細を教えていただけますか？')
                : responseText;
              
              // Save assistant message to database
              if (!isDevelopment) {
                const assistantMessage: DBMessage = {
                  id: nanoid(),
                  chatId: chatId,
                  role: 'assistant',
                  content: {
                    type: 'text',
                    text: finalResponseText
                  },
                  createdAt: new Date()
                };

                await saveMessages({ 
                  messages: [{
                    id: assistantMessage.id,
                    chatId: assistantMessage.chatId,
                    role: assistantMessage.role,
                    content: typeof assistantMessage.content === 'object' ? JSON.stringify(assistantMessage.content) : assistantMessage.content,
                    createdAt: assistantMessage.createdAt
                  }]
                });
              }
            } catch (error) {
              console.error('[API Deep Research] Error in onFinish callback:', error);
            }
          },
        });

        // Merge result into data stream
        result.mergeIntoDataStream(dataStream);
      },
      onError: (error) => {
        console.error('[API Deep Research] Error in streaming response:', error);
        return 'メッセージの送信に失敗しました。もう一度お試しください。';
      },
    });
  } catch (error) {
    console.error('[API Deep Research] API Error details:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      { 
        status: 500,
        headers: {
          'X-Error': 'true',
          'X-Error-Type': 'InternalServerError'
        }
      }
    );
  }
}
