import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { ArtifactKind } from '@/components/artifact';
import { VisibilityType } from '@/components/visibility-selector';
import type { DBMessage } from '@/lib/db/types';

export async function getUser(email: string): Promise<Array<any>> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('email', email);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);
  const supabase = await createClient();

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: '/auth/callback'
      }
    });

    if (authError) throw authError;

    if (authData.user) {
      const { error: insertError } = await supabase
        .from('User')
        .insert({
          id: authData.user.id,
          email,
          password: hash
        });

      if (insertError) throw insertError;
    }

    return authData;
  } catch (error) {
    console.error('Failed to create user:', error);
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  const supabase = await createClient();
  try {
    // チャットの重複チェック
    const { data: existingChat } = await supabase
      .from('Chat')
      .select('id')
      .eq('id', id)
      .single();

    if (existingChat) {
      // チャットが既に存在する場合は更新
      const { error: updateError } = await supabase
        .from('Chat')
        .update({ title })
        .eq('id', id);

      if (updateError) {
        console.error('Failed to update chat:', updateError);
        throw new Error('Failed to update chat');
      }
    } else {
      // 新しいチャットを作成
      const { error: insertError } = await supabase
        .from('Chat')
        .insert({
          id,
          userId,
          title,
          visibility: 'private',  // デフォルトは非公開
          createdAt: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Failed to insert chat:', insertError);
        throw new Error('Failed to create chat');
      }
    }

    return { id };
  } catch (error) {
    console.error('Database operation failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  const supabase = await createClient();
  try {
    // First delete related votes
    const { error: voteError } = await supabase
      .from('Vote')
      .delete()
      .eq('chatId', id);

    if (voteError) throw voteError;

    // Then delete messages
    const { error: messageError } = await supabase
      .from('Message')
      .delete()
      .eq('chatId', id);

    if (messageError) throw messageError;

    // Finally delete the chat
    const { error: chatError } = await supabase
      .from('Chat')
      .delete()
      .eq('id', id);

    if (chatError) throw chatError;
  } catch (error) {
    console.error('Failed to delete chat from database');
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Chat')
      .select('*')
      .eq('userId', id)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get chats by user id from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Chat')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<any> }): Promise<Array<DBMessage | null>> {
  const supabase = await createClient();
  try {
    console.log('Saving messages:', JSON.stringify(messages, null, 2));
    
    // メッセージの検証
    if (!Array.isArray(messages)) {
      const error = new Error('Invalid messages format: not an array');
      console.error('Validation error:', {
        error: error.message,
        receivedType: typeof messages,
        receivedValue: messages
      });
      throw error;
    }

    // 各メッセージのサイズ検証
    messages.forEach((msg, index) => {
      const messageSize = JSON.stringify(msg).length;
      console.log(`Message ${index} size:`, messageSize, 'bytes');
      if (messageSize > 100 * 1024) { // 100KB制限
        throw new Error(`Message ${index} size (${messageSize} bytes) exceeds limit (100KB)`);
      }
    });

    // 各メッセージのIDの重複チェック
    const messageIds = messages.map(msg => msg.id);
    const uniqueIds = new Set(messageIds);
    if (messageIds.length !== uniqueIds.size) {
      const duplicates = messageIds.filter((id, index) => messageIds.indexOf(id) !== index);
      const error = new Error('Duplicate message IDs detected');
      console.error('Validation error:', {
        error: error.message,
        duplicateIds: duplicates
      });
      throw error;
    }

    // 既存のメッセージをチェック
    const existingMessages = await Promise.all(
      messages.map(async (message) => {
        const { data, error } = await supabase
          .from('Message')
          .select('id')
          .eq('id', message.id)
          .maybeSingle();
        
        if (error) {
          console.error('Database error:', {
            operation: 'check existing message',
            messageId: message.id,
            error
          });
          throw new Error(`Database error while checking message ${message.id}: ${error.message}`);
        }
        return data;
      })
    );

    console.log('Existing messages check:', existingMessages);

    // 各メッセージの保存
    const savedMessages = await Promise.all(
      messages.map(async (message, index) => {
        console.log(`Processing message ${index}:`, {
          id: message.id,
          chatId: message.chatId,
          role: message.role,
          contentType: typeof message.content,
          contentSize: JSON.stringify(message.content).length
        });
        
        if (!message.chatId || !message.role || !message.content) {
          const error = new Error(`Invalid message format at index ${index}: missing required fields`);
          console.error('Validation error:', {
            error: error.message,
            message: {
              id: message.id,
              chatId: message.chatId,
              role: message.role,
              hasContent: !!message.content
            }
          });
          throw error;
        }

        // 既存のメッセージは更新、新しいメッセージは挿入
        const isExisting = existingMessages[index] !== null;
        const operation = isExisting ? 'upsert' : 'insert';
        console.log(`${operation} message ${message.id}`);

        const { data, error } = await supabase
          .from('Message')
          .upsert({
            id: message.id,
            chatId: message.chatId,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt || new Date().toISOString()
          }, {
            onConflict: 'id'
          });

        if (error) {
          console.error('Database error:', {
            operation,
            messageId: message.id,
            error
          });
          throw new Error(`Failed to ${operation} message: ${JSON.stringify(error)}`);
        }

        console.log(`Successfully ${operation}ed message:`, message.id);
        return data;
      })
    );

    console.log('Successfully saved all messages:', savedMessages);
    return savedMessages;
  } catch (error) {
    console.error('Failed to save messages to database:', {
      error,
      errorType: error instanceof Error ? 'Error' : typeof error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Message')
      .select('*')
      .eq('chatId', id)
      .order('createdAt', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  const supabase = await createClient();
  try {
    console.log('Saving vote:', { chatId, messageId, type });
    const { data, error } = await supabase
      .from('Vote')
      .upsert({
        chatId,
        messageId,
        isUpvoted: type === 'up',
        createdAt: new Date().toISOString(),
      }, {
        onConflict: 'chatId,messageId'
      });

    if (error) {
      console.error('Database error while saving vote:', error);
      throw error;
    }

    console.log('Vote saved successfully:', data);
    return data;
  } catch (error) {
    console.error('Failed to vote message in database:', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Document')
      .insert({
        id,
        title,
        content,
        userId,
        createdAt: new Date().toISOString()
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<any>;
}) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Suggestion')
      .insert(suggestions.map(suggestion => ({
        id: suggestion.id,
        documentId: suggestion.documentId,
        documentCreatedAt: suggestion.documentCreatedAt,
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        description: suggestion.description,
        isResolved: suggestion.isResolved,
        userId: suggestion.userId,
        createdAt: suggestion.createdAt || new Date().toISOString()
      })));

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Suggestion')
      .select('*')
      .eq('documentId', documentId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
      error,
    );
    throw error;
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from('Chat')
      .update({ visibility })
      .eq('id', chatId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Document')
      .select('*')
      .eq('id', id)
      .order('createdAt', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Document')
      .select('*')
      .eq('id', id)
      .order('createdAt', { ascending: false })
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  const supabase = await createClient();
  try {
    const { error: deleteError } = await supabase
      .from('Suggestion')
      .delete()
      .eq('documentId', id)
      .gt('documentCreatedAt', timestamp.toISOString());

    if (deleteError) throw deleteError;

    const { error: deleteDocumentError } = await supabase
      .from('Document')
      .delete()
      .eq('id', id)
      .gt('createdAt', timestamp.toISOString());

    if (deleteDocumentError) throw deleteDocumentError;
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function getVotesByChatId({ chatId }: { chatId: string }) {
  const supabase = await createClient();
  try {
    console.log('Getting votes for chat:', chatId);
    
    // まずチャットの存在を確認
    const { data: chat, error: chatError } = await supabase
      .from('Chat')
      .select('id')
      .eq('id', chatId)
      .maybeSingle();

    if (chatError) {
      console.error('Failed to find chat:', chatError);
      // チャットが見つからない場合は空の配列を返す
      if (chatError.code === 'PGRST116') {
        console.log('Chat not found, returning empty array');
        return [];
      }
      throw new Error(`Database error while finding chat: ${chatError.message}`);
    }

    if (!chat) {
      console.log('Chat not found, returning empty array');
      return [];
    }

    // 投票を取得
    const { data, error } = await supabase
      .from('Vote')
      .select('messageId, isUpvoted, createdAt')
      .eq('chatId', chatId)
      .order('createdAt', { ascending: true });

    if (error) {
      console.error('Failed to get votes:', error);
      // データベースエラーの場合は空の配列を返す
      if (error.code === 'PGRST116') {
        console.log('No votes found, returning empty array');
        return [];
      }
      throw new Error(`Database error while getting votes: ${error.message}`);
    }

    console.log('Retrieved votes:', data);
    return data || [];
  } catch (error) {
    console.error('Failed to get votes by chat id:', error);
    // エラーを上位に伝播させる代わりに空の配列を返す
    console.log('Returning empty array due to error');
    return [];
  }
}

export async function getMessageById({ id }: { id: string }) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('Message')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  const supabase = await createClient();
  try {
    // メッセージIDの取得
    const { data: messages, error: getMessagesError } = await supabase
      .from('Message')
      .select('id')
      .eq('chatId', chatId)
      .gte('createdAt', timestamp.toISOString());

    if (getMessagesError) throw getMessagesError;

    if (messages && messages.length > 0) {
      const messageIds = messages.map((msg) => msg.id);

      // 関連する投票の削除
      const { error: deleteVoteError } = await supabase
        .from('Vote')
        .delete()
        .eq('chatId', chatId)
        .in('messageId', messageIds);

      if (deleteVoteError) throw deleteVoteError;

      // メッセージの削除
      const { error: deleteMessagesError } = await supabase
        .from('Message')
        .delete()
        .eq('chatId', chatId)
        .gte('createdAt', timestamp.toISOString());

      if (deleteMessagesError) throw deleteMessagesError;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete messages by chat id and timestamp');
    throw error;
  }
}

export async function createClient() {
  const cookieStore = await cookies();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials. Please check your environment variables.');
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      }
    }
  );
}
