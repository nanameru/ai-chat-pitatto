'use client';

import type { Attachment, Message, CreateMessage, ChatRequestOptions } from 'ai';
import { useChat } from 'ai/react';
import { useEffect, useOptimistic, useState, useRef, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { XSearchResponse } from '@/lib/types';

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
import { useLocalStorage } from '../hooks/use-local-storage';

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
  
  // カスタムフックを使用して、isXSearchEnabledの値を監視
  const [isXSearchEnabled, setIsXSearchEnabled] = useLocalStorage('searchMode', false);
  
  // useChat の再初期化のための一意のキーを生成
  const [chatKey, setChatKey] = useState(`${id}-${isXSearchEnabled ? 'xsearch' : 'chat'}`);
  
  // isXSearchEnabled が変更されたときにchatKeyを更新
  useEffect(() => {
    console.log(`[Mode] モードが変更されました: ${isXSearchEnabled ? 'X検索モード' : 'チャットモード'}`);
    console.log(`[Mode] 使用するAPI: ${isXSearchEnabled ? '/api/x-search/feedback' : '/api/chat'}`);
    
    // useChat を強制的に再初期化するためのキーを更新
    const newKey = `${id}-${isXSearchEnabled ? 'xsearch' : 'chat'}-${Date.now()}`;
    console.log(`[Chat] チャットキーを更新します: ${newKey}`);
    setChatKey(newKey);
  }, [isXSearchEnabled, id]);
  
  // チャットの状態を保持するための参照
  const chatStateRef = useRef<{
    messages: Array<Message>;
    input: string;
  }>({
    messages: [],
    input: '',
  });

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

  // チャットの状態が変わったときに参照を更新
  const updateChatStateRef = useCallback((messages: Array<Message>, input: string) => {
    chatStateRef.current = {
      messages,
      input,
    };
  }, []);

  // 共通のチャットオプション
  const chatOptions = {
    id,
    initialMessages,
    body: {
      chatId: id,
      model: selectedChatModel,
      visibilityType: selectedVisibilityType,
    },
    onResponse: (response: Response) => {
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      const currentModel = chatModels.find(model => model.id === selectedChatModel);
      console.log('🤖 Generating with:', {
        name: currentModel?.name,
        version: currentModel?.modelVersion,
        mode: isXSearchEnabled ? 'X Search' : 'Regular Chat'
      });
    },
    onFinish: (message: Message) => {
      console.log('Finished message:', message);
    },
    onError: (error: Error) => {
      console.error('Chat error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        raw: error,
        mode: isXSearchEnabled ? 'X Search' : 'Regular Chat'
      });

      if (!chatStateRef.current.messages.length || 
          chatStateRef.current.messages[chatStateRef.current.messages.length - 1].role === 'user') {
        toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
      }
    }
  };

  // モードに応じたuseChat hookの使用
  // key プロパティを追加して isXSearchEnabled が変更されたときに再初期化されるようにする
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    error,
    data,
    stop,
    setInput,
    append: originalAppend,
    setMessages: originalSetMessages,
    reload
  } = useChat({
    ...chatOptions,
    // モードに応じたAPIエンドポイントを明示的に指定
    api: isXSearchEnabled ? '/api/x-search/feedback' : '/api/chat', 
    body: {
      ...chatOptions.body,
      xSearchEnabled: isXSearchEnabled, // APIに現在のモードを渡す
    },
    id: chatKey, // 動的に生成されたキーを使用して再初期化を強制
    // initialMessages を空にすることでチャットの初期状態をリセット
    initialMessages: [] 
  });

  // モード変更時に既存のメッセージをクリア
  useEffect(() => {
    console.log(`[Force Reset] モード変更による useChat の再初期化: ${isXSearchEnabled ? 'X検索モード' : 'チャットモード'}`);
    // 既存のメッセージをクリア
    if (messages.length > 0) {
      console.log(`[Force Reset] 既存のメッセージをクリア（${messages.length}件）`);
      originalSetMessages([]);
    }
  }, [chatKey, isXSearchEnabled]);

  // チャットの状態が変わったときに参照を更新
  useEffect(() => {
    updateChatStateRef(messages, input);
  }, [messages, input, updateChatStateRef]);

  // カスタムイベントをリッスンして、ローカルストレージの値を直接確認
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const { enabled, previous, timestamp } = event.detail;
      console.log('[Event] X検索モード変更イベントを受信:', {
        前のモード: previous ? 'X検索モード' : '通常チャットモード',
        新しいモード: enabled ? 'X検索モード' : '通常チャットモード',
        タイムスタンプ: new Date(timestamp).toLocaleTimeString()
      });
      
      // モードが変更された場合のみ処理を実行
      if (enabled !== isXSearchEnabled) {
        console.log('[Event] モード変更を検出、チャットを再初期化します');
        
        // 既存のメッセージをクリア
        if (messages.length > 0) {
          console.log(`[Event] 既存のメッセージをクリア（${messages.length}件）`);
          originalSetMessages([]);
        }
        
        // 状態を即座に更新
        setIsXSearchEnabled(enabled);
        
        // 即座に新しいキーを生成して useChat を強制的に再初期化
        const forcedNewKey = `${id}-${enabled ? 'xsearch' : 'chat'}-${Date.now()}-forced`;
        console.log(`[Event] チャットキーを強制更新: ${forcedNewKey}`);
        setChatKey(forcedNewKey);
        
        // APIを即座に切り替え
        if (reload) {
          console.log(`[Event] useChat のリロードを実行`);
          reload({
            data: {
              chatId: id,
              model: selectedChatModel,
              xSearchEnabled: enabled
            }
          });
          console.log(`[Event] リロード完了: ${enabled ? 'X検索モード' : '通常チャットモード'} が有効になりました`);
        }
      }
    };

    // イベントリスナーを追加
    window.addEventListener('xsearch-mode-changed', handleModeChange as EventListener);

    // クリーンアップ関数
    return () => {
      window.removeEventListener('xsearch-mode-changed', handleModeChange as EventListener);
    };
  }, [isXSearchEnabled, id, setIsXSearchEnabled, setChatKey, originalSetMessages, selectedChatModel, reload, messages.length]);

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
        <div className="size-full max-w-3xl flex flex-col">
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
                    selectedModelId={selectedChatModel}
                    isXSearchEnabled={isXSearchEnabled}
                    onXSearchToggle={(newValue) => {
                      const oldValue = isXSearchEnabled;
                      
                      // ボタンクリック時のフィードバックを詳細にログ出力
                      console.log(`[Parent] X検索ボタンがクリックされました`);
                      console.log(`[Parent] X検索モード変更: ${oldValue ? 'X検索モード' : '通常チャットモード'} → ${newValue ? 'X検索モード' : '通常チャットモード'}`);
                      console.log(`[Parent] 現在の状態: ${newValue}`);
                      console.log(`[Parent] API変更: ${oldValue ? '/api/x-search/feedback' : '/api/chat'} → ${newValue ? '/api/x-search/feedback' : '/api/chat'}`);
                      
                      // まず既存のメッセージをクリア（モード切替時は常にチャットをリセット）
                      if (messages.length > 0) {
                        console.log(`[Reset] チャットの状態をリセットします（${messages.length}件のメッセージをクリア）`);
                        originalSetMessages([]);
                      }
                      
                      // 状態を即座に更新
                      setIsXSearchEnabled(newValue);
                      
                      // 即座に新しいキーを生成して useChat を強制的に再初期化
                      // タイムスタンプを含めることで必ず異なるキーになる
                      const forcedNewKey = `${id}-${newValue ? 'xsearch' : 'chat'}-${Date.now()}`;
                      console.log(`[Chat] チャットキーを更新: ${forcedNewKey}`);
                      setChatKey(forcedNewKey);
                      
                      // APIエンドポイントを即座に切り替える
                      console.log(`[API] エンドポイントを切り替え: ${newValue ? '/api/x-search/feedback' : '/api/chat'}`);
                      
                      // useChat を強制的に再初期化
                      if (reload) {
                        console.log(`[Refresh] useChat を強制的に再初期化します`);
                        reload({
                          data: {
                            chatId: id,
                            model: selectedChatModel,
                            xSearchEnabled: newValue
                          }
                        });
                        console.log(`[Refresh] 完了: ${newValue ? 'X検索モード' : '通常チャットモード'} が有効になりました`);
                      }
                    }}
                    handleSubmit={async (
                      event?: {
                        preventDefault?: () => void;
                      },
                      options?: ChatRequestOptions & { xSearchEnabled?: boolean }
                    ) => {
                      if (event?.preventDefault) {
                        event.preventDefault();
                      }
                      try {
                        return await originalHandleSubmit(event, {
                          ...options,
                          data: {
                            chatId: id,
                            model: selectedChatModel,
                            ...(options?.data as Record<string, unknown> || {}),
                            id: generateUUID()
                          }
                        });
                      } catch (error) {
                        console.error('Chat submission error:', {
                          error,
                          mode: options?.xSearchEnabled ? 'X Search' : 'Regular Chat',
                          timestamp: new Date().toISOString()
                        });
                        toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
                        throw error;
                      }
                    }}
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
        handleSubmit={async (
          event?: {
            preventDefault?: () => void;
          },
          options?: ChatRequestOptions & { xSearchEnabled?: boolean }
        ) => {
          if (event?.preventDefault) {
            event.preventDefault();
          }
          const message: CreateMessage = {
            id: generateUUID(),
            content: input,
            role: 'user',
            createdAt: new Date()
          };
          await originalAppend(message, options);
        }}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        messages={messages}
        setMessages={originalSetMessages}
        append={originalAppend}
        selectedModelId={selectedChatModel}
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
