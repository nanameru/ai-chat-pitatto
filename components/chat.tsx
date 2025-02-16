'use client';

import type { Attachment, Message, CreateMessage, ChatRequestOptions } from 'ai';
import { useChat } from 'ai/react';
import { useEffect, useOptimistic, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';

import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { chatModels } from '@/lib/ai/models';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const { data: session } = useSWR('/api/auth/session', fetcher);

  useEffect(() => {
    if (!session) {
      toast.error('ログインが必要です。');
    }
  }, [session]);

  // ローカルストレージのクリーンアップ関数
  const cleanupLocalStorage = () => {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      let cleaned = 0;
      
      // 古いメッセージを削除
      keys.forEach(key => {
        if (key.startsWith('message_')) {
          try {
            localStorage.removeItem(key);
            cleaned++;
          } catch (e) {
            console.error('Failed to remove item:', key, e);
          }
        }
      });

      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} items from localStorage`);
      }
    } catch (e) {
      console.error('LocalStorage cleanup error:', e);
    }
  };

  // 初期ロード時にクリーンアップを実行
  useEffect(() => {
    cleanupLocalStorage();
  }, []);

  const [optimisticModelId, setOptimisticModelId] = useOptimistic(selectedChatModel);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    data,
    stop,
    setInput,
    append: originalAppend,
    setMessages: originalSetMessages
  } = useChat({
    api: '/api/chat',
    id,
    initialMessages,
    body: {
      chatId: id,
      model: optimisticModelId,
      visibilityType: selectedVisibilityType,
    },
    onResponse: (response) => {
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      // 現在使用中のモデル情報を表示
      const currentModel = chatModels.find(model => model.id === optimisticModelId);
      console.log('🤖 Generating with:', {
        name: currentModel?.name,
        version: currentModel?.modelVersion
      });
    },
    onFinish: (message) => {
      console.log('Finished message:', message);
    },
    onError: (error) => {
      console.error('Chat error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        raw: error
      });

      // エラーが発生しても、メッセージが表示されている場合は
      // ユーザーエクスペリエンスを維持するためにエラーを表示しない
      if (!messages.length || messages[messages.length - 1].role === 'user') {
        toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
      }
      
      stop();
    }
  });

  const { data: votes, error: votesError } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher,
    {
      revalidateOnFocus: false,
      onError: (error) => {
        console.error('Votes error:', error);
        // 500エラーの場合は静かに失敗
        if (error?.status === 500) {
          console.warn('Failed to load votes, continuing without votes');
          return;
        }
        toast.error('Failed to load votes');
      }
    }
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  const handleSetInput = (newInput: string) => {
    setInput(newInput);
  };

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <div className="w-full">
          <ChatHeader
            chatId={id}
            selectedModelId={selectedChatModel}
            selectedVisibilityType={selectedVisibilityType}
            isReadonly={isReadonly}
          />
        </div>

        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-3xl">
            <Messages
              chatId={id}
              isLoading={isLoading}
              votes={votes}
              messages={messages}
              setMessages={originalSetMessages}
              isReadonly={isReadonly}
              isArtifactVisible={isArtifactVisible}
            />

            <form className="flex px-4 bg-background pb-4 md:pb-6 gap-2 w-full">
              {!isReadonly && (
                <MultimodalInput
                  chatId={id}
                  input={input}
                  setInput={handleSetInput}
                  isLoading={isLoading}
                  stop={stop}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  messages={messages}
                  setMessages={originalSetMessages}
                  append={originalAppend}
                  handleSubmit={handleSubmit}
                />
              )}
            </form>
          </div>
        </div>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={handleSetInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        messages={messages}
        setMessages={originalSetMessages}
        append={originalAppend}
        reload={async (chatRequestOptions) => {
          useChat({
            api: '/api/chat',
            id,
            initialMessages,
            body: {
              chatId: id,
              model: optimisticModelId,
              visibilityType: selectedVisibilityType,
            },
            onResponse: (response) => {
              console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            },
            onError: (error) => {
              console.error('Chat error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: error.cause
              });

              // エラーが発生しても、メッセージが表示されている場合は
              // ユーザーエクスペリエンスを維持するためにエラーを表示しない
              if (!messages.length || messages[messages.length - 1].role === 'user') {
                toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
              }
              
              stop();
              cleanupLocalStorage();
            },
            onFinish: (message) => {
              console.log('Finished message:', message);
              cleanupLocalStorage();
            }
          });
          return Promise.resolve(null);
        }}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}
