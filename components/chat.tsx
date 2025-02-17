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
import { Overview } from './overview';
import { SuggestedActions } from './suggested-actions';

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
    <div className="relative flex flex-col min-h-screen">
      <ChatHeader
        chatId={id}
        selectedModelId={selectedChatModel}
        selectedVisibilityType={selectedVisibilityType}
        isReadonly={isReadonly}
      />

      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-3xl flex flex-col h-full">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <Overview />
            </div>
          ) : (
            <div className="flex-1">
              <Messages
                chatId={id}
                isLoading={isLoading}
                votes={votes}
                messages={messages}
                setMessages={originalSetMessages}
                isReadonly={isReadonly}
                isArtifactVisible={isArtifactVisible}
              />
            </div>
          )}

          <div className="sticky bottom-0 z-10 bg-background">
            <form className="flex flex-col px-4 bg-background pb-4 md:pb-6 gap-2 w-full" onSubmit={(e) => e.preventDefault()}>
              {!isReadonly && (
                <>
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
                  {messages.length === 0 && (
                    <div className="mt-4">
                      <SuggestedActions
                        suggestions={[
                          {
                            title: "AIの最新情報を教えて",
                            description: "最新のAI技術動向やニュースについて",
                            onClick: () => {
                              handleSetInput("AIの最新情報を教えてください。特に注目すべき進展や重要なニュースを教えてください。");
                            }
                          },
                          {
                            title: "1日前のAI情報を教えて",
                            description: "昨日のAIに関する重要な出来事",
                            onClick: () => {
                              handleSetInput("1日前のAI関連の情報を教えてください。昨日起きた重要な出来事や発表について知りたいです。");
                            }
                          },
                          {
                            title: "10月のAI情報を教えて",
                            description: "10月の主要なAIニュースやトレンド",
                            onClick: () => {
                              handleSetInput("10月のAI関連の情報を教えてください。その月の主要な出来事、発表、トレンドについてまとめてください。");
                            }
                          },
                          {
                            title: "アカウントを分析して",
                            description: "あなたのアカウントの利用状況を分析",
                            onClick: () => {
                              handleSetInput("私のアカウントについて分析してください。利用パターンや特徴的な傾向について教えてください。");
                            }
                          }
                        ]}
                        append={originalAppend}
                        chatId={id}
                      />
                    </div>
                  )}
                </>
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
          // 既存のチャットインスタンスを使用して新しいメッセージを送信
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chatId: id,
              model: optimisticModelId,
              visibilityType: selectedVisibilityType,
              messages: initialMessages
            }),
          });

          if (!response.ok) {
            console.error('Chat error:', await response.text());
            toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
            return null;
          }

          const reader = response.body?.getReader();
          if (!reader) return null;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              // 進行状況をコンソールに表示
              console.log('Response chunk:', new TextDecoder().decode(value));
            }
          } finally {
            reader.releaseLock();
          }

          return null;
        }}
        votes={votes}
        isReadonly={isReadonly}
      />
    </div>
  );
}
