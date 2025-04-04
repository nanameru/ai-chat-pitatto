'use client';

import type { Attachment, Message, CreateMessage, ChatRequestOptions } from 'ai';
import { useChat } from 'ai/react';
import { useEffect, useOptimistic, useState, useRef, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ReasoningSidebar } from '@/components/reasoning-sidebar';
import type { ReasoningStep } from '@/types/reasoning';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { nanoid } from 'nanoid'; // nanoid をインポート

import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { chatModels } from '@/lib/ai/models';
import { Overview } from './overview';
import { SuggestedActions } from './suggested-actions';
import { useLocalStorage } from '../hooks/use-local-storage';
import { useComputerUse } from '../lib/hooks/use-computer-use';
import { useSearchParams } from 'next/navigation';

// サンプル提案を生成する関数
function getExampleSuggestions(append, setInput) {
  return [
    {
      title: 'AIの最新トレンド',
      description: '生成AIの最新技術や研究について教えてください',
      onClick: () => {
        const input = '生成AIの最新技術や研究について教えてください';
        const message = {
          id: nanoid(),
          content: input,
          role: 'user',
          createdAt: new Date()
        };
        append(message);
        setInput('');
      }
    },
    {
      title: 'プログラミング支援',
      description: 'コードの書き方や最適化について質問できます',
      onClick: () => {
        const input = 'Reactでパフォーマンスを最適化するベストプラクティスを教えてください';
        const message = {
          id: nanoid(),
          content: input,
          role: 'user',
          createdAt: new Date()
        };
        append(message);
        setInput('');
      }
    },
    {
      title: 'データ分析のコツ',
      description: '効果的なデータ分析の方法を教えてください',
      onClick: () => {
        const input = '大量のデータから意味のある洞察を得るための効果的なデータ分析方法を教えてください';
        const message = {
          id: nanoid(),
          content: input,
          role: 'user',
          createdAt: new Date()
        };
        append(message);
        setInput('');
      }
    },
    {
      title: '学習リソース',
      description: '機械学習を学ぶための良い教材を紹介してください',
      onClick: () => {
        const input = '機械学習を効率的に学ぶためのおすすめの学習リソースを教えてください';
        const message = {
          id: nanoid(),
          content: input,
          role: 'user',
          createdAt: new Date()
        };
        append(message);
        setInput('');
      }
    }
  ];
}

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Message[];
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const { data: session } = useSWR('/api/auth/session', fetcher);
  
  // カスタムフックを使用して、isXSearchEnabledの値を監視
  const [isXSearchEnabled, setIsXSearchEnabled] = useLocalStorage('searchMode', false);
  
  // Computer Use機能の状態を監視
  const [isComputerUseEnabled, setIsComputerUseEnabled] = useLocalStorage('computerUseMode', false);
  const { isLoading: isComputerUseLoading } = useComputerUse();
  
  // URLからクエリパラメータを取得
  const searchParams = useSearchParams();
  const refreshParam = searchParams.get('refresh');

  // 推論ステップの状態管理
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [isReasoningLoading, setIsReasoningLoading] = useState(false);
  const [showReasoningSidebar, setShowReasoningSidebar] = useState(true);
  
  // 内部で管理するメッセージ状態
  const [currentMessages, setCurrentMessages] = useState<Message[]>(initialMessages);
  
  // useChat の再初期化のための一意のキーを生成
  const [chatKey, setChatKey] = useState(`${id}-${isComputerUseEnabled ? 'computer-use' : isXSearchEnabled ? 'xsearch' : 'chat'}-${refreshParam || Date.now()}`);
  
  // チャットIDが変更されたときに内部状態を更新
  useEffect(() => {
    console.log(`[Chat] チャットIDが変更されました: ${id}`);
    console.log(`[Chat] 初期メッセージ数: ${initialMessages.length}`);
    console.log(`[Chat] 初期メッセージの内容:`, JSON.stringify(initialMessages));
    console.log(`[Chat] リフレッシュパラメータ: ${refreshParam}`);
    
    // 内部状態を更新
    setCurrentMessages(initialMessages);
    
    // チャットキーを更新して強制的に再初期化
    const newKey = `${id}-${isComputerUseEnabled ? 'computer-use' : isXSearchEnabled ? 'xsearch' : 'chat'}-${refreshParam || Date.now()}`;
    console.log(`[Chat] チャットキーを更新します: ${newKey}`);
    setChatKey(newKey);
    
  }, [id, initialMessages, isXSearchEnabled, isComputerUseEnabled, refreshParam]);
  
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
      
      // ストリーミング終了時に最終メッセージを確実に保持
      setTimeout(() => {
        // 現在のメッセージ配列を取得
        const currentMessages = chatStateRef.current.messages;
        
        // 最後のメッセージが完了したメッセージと一致するか確認
        const lastMessage = currentMessages.length > 0 ? 
          currentMessages[currentMessages.length - 1] : null;
          
        // 最後のメッセージが存在しないか、内容が異なる場合は更新
        if (!lastMessage || 
            (lastMessage.role === 'assistant' && lastMessage.content !== message.content)) {
          console.log('[Chat] ストリーミング完了後のメッセージを確保します');
          
          // 既存のメッセージ配列から完了したメッセージと同じIDのものを除外
          const filteredMessages = currentMessages.filter(m => m.id !== message.id);
          
          // 完了したメッセージを追加
          originalSetMessages([...filteredMessages, message]);
        }
      }, 50);
    },
    onError: (error: Error) => {
      console.error('Chat error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        raw: error,
        mode: isComputerUseEnabled ? 'Computer Use' : isXSearchEnabled ? 'X Search' : 'Regular Chat'
      });

      if (!chatStateRef.current.messages.length || 
          chatStateRef.current.messages[chatStateRef.current.messages.length - 1].role === 'user') {
        toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
      }
    }
  };

  // モードに応じたuseChat hookの使用
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
    api: isComputerUseEnabled ? '/api/computer-use' : isXSearchEnabled ? '/api/deep-research/feedback' : '/api/chat', 
    body: {
      ...chatOptions.body,
      xSearchEnabled: isXSearchEnabled, // APIに現在のモードを渡す
      computerUseEnabled: isComputerUseEnabled, // Computer Useモードを渡す
      preserveMessages: true // 既存のメッセージを保持するフラグを追加
    },
    id: chatKey, // 動的に生成されたキーを使用して再初期化
    // 初期メッセージを設定
    initialMessages: currentMessages
  });

  // useChatの初期化後に初期メッセージを設定
  useEffect(() => {
    if (currentMessages.length > 0 && messages.length === 0) {
      console.log(`[Chat] 初期メッセージを設定します (${currentMessages.length}件)`);
      originalSetMessages(currentMessages);
      
      // 設定後のメッセージ数を確認
      console.log(`[Chat] 設定後のメッセージ数: ${messages.length}`);
    }
  }, [chatKey, currentMessages, originalSetMessages, messages.length]);

  // カスタムappend関数を作成して既存のメッセージを保持
  const append = useCallback(
    async (message: Message | CreateMessage, options?: ChatRequestOptions) => {
      // 現在のメッセージを保存
      const currentMsgs = [...messages];
      
      try {
        // 通常のappendを呼び出す
        const result = await originalAppend(message, {
          ...options,
          data: {
            ...((options?.data as Record<string, unknown>) || {}),
            preserveMessages: true
          }
        });
        
        // ストリーミング完了時またはメッセージが失われた場合に復元
        setTimeout(() => {
          // 最新のメッセージを取得
          const latestMessages = chatStateRef.current.messages;
          
          // ストリーミング完了後のメッセージ数をチェック
          if (latestMessages.length < currentMsgs.length + 1) {
            console.log('[Chat] メッセージが失われたため復元します');
            
            // 新しいメッセージを作成
            const newMessage = {
              id: typeof message === 'object' && 'id' in message ? 
                  (message.id || nanoid()) : // id が undefined の場合は新しい ID を生成
                  nanoid(),
              content: typeof message === 'string' ? message : message.content,
              role: typeof message === 'string' ? 'user' : message.role,
              createdAt: typeof message === 'string' ? new Date() : (message.createdAt || new Date())
            };
            
            // 完全なメッセージリストを再構築
            const restoredMessages = [...currentMsgs, newMessage];
            console.log('[Chat] 復元後のメッセージ数:', restoredMessages.length);
            
            // メッセージを更新
            originalSetMessages(restoredMessages);
          } else {
            // メッセージが正しく存在する場合でも、内容が最新であることを確認
            const lastMessage = latestMessages[latestMessages.length - 1];
            const expectedContent = typeof message === 'string' ? message : message.content;
            
            // 最後のメッセージの内容が期待と異なる場合は更新
            if (lastMessage && lastMessage.role === (typeof message === 'string' ? 'user' : message.role) && 
                lastMessage.content !== expectedContent) {
              console.log('[Chat] 最後のメッセージの内容を更新します');
              
              // 最後のメッセージを更新
              const updatedMessages = [...latestMessages];
              updatedMessages[updatedMessages.length - 1] = {
                ...updatedMessages[updatedMessages.length - 1],
                content: expectedContent
              };
              
              originalSetMessages(updatedMessages);
            }
          }
        }, 100); // 少し遅延させて状態の更新を確実にする
        
        return result;
      } catch (error) {
        console.error('[Chat] メッセージ送信エラー:', {
          error,
          api: isComputerUseEnabled ? '/api/computer-use' : isXSearchEnabled ? '/api/deep-research/feedback' : '/api/chat',
          mode: isComputerUseEnabled ? 'Computer Use' : isXSearchEnabled ? 'X Search' : 'Regular Chat',
          messageType: typeof message === 'string' ? 'string' : message.role,
          options
        });
        toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
        throw error;
      }
    },
    [messages, originalAppend, originalSetMessages, chatStateRef, isXSearchEnabled, isComputerUseEnabled]
  );

  // チャットの状態が変わったときに参照を更新
  useEffect(() => {
    updateChatStateRef(messages, input);
  }, [messages, input, updateChatStateRef]);

  // モデル変更イベントをリッスンして、モデル選択が即時に反映されるようにする
  useEffect(() => {
    const handleModelChange = (event: CustomEvent) => {
      const { modelId } = event.detail;
      
      console.log('[Event] モデル変更イベントを受信:', {
        前のモデル: selectedChatModel,
        新しいモデル: modelId,
        タイムスタンプ: Date.now()
      });
      
      if (modelId && modelId !== selectedChatModel) {
        // 新しいチャットキーを生成して useChat を再初期化
        const timestamp = Date.now();
        const newKey = `${id}-${modelId}-${timestamp}`;
        console.log(`[Chat] モデル変更によりチャットキーを更新: ${newKey}`);
        setChatKey(newKey);
        
        // useChat を再初期化
        if (reload) {
          console.log(`[Refresh] モデル変更により useChat を再初期化します`);
          try {
            reload({
              data: {
                chatId: id,
                model: modelId,
                xSearchEnabled: isXSearchEnabled,
                computerUseEnabled: isComputerUseEnabled,
                timestamp: timestamp,
                forceReset: false // メッセージは保持
              }
            });
            console.log(`[Refresh] 完了: モデルが ${modelId} に変更されました`);
          } catch (error) {
            console.error('[モデル変更] リロードエラー:', error);
            toast.error('モデル変更に失敗しました。ページを再読み込みします。');
            window.location.reload();
          }
        }
      }
    };
    
    // モデル変更イベントリスナーを追加
    window.addEventListener('modelChanged', handleModelChange as EventListener);
    
    // クリーンアップ関数
    return () => {
      window.removeEventListener('modelChanged', handleModelChange as EventListener);
    };
  }, [id, selectedChatModel, setChatKey, reload, isXSearchEnabled, isComputerUseEnabled]);

  // X検索モード変更イベントをリッスン
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const { enabled, previous, timestamp, force, immediate, source, resetChat, silentMode } = event.detail;
      
      // silentModeフラグがある場合はログを抑制
      if (!silentMode) {
        console.log('[Event] X検索モード変更イベントを受信:', {
          前のモード: previous ? 'X検索モード' : '通常チャットモード',
          新しいモード: enabled ? 'X検索モード' : '通常チャットモード',
          タイムスタンプ: timestamp,
          強制更新: force ? 'あり' : 'なし',
          即時更新: immediate ? 'あり' : 'なし',
          ソース: source || '不明',
          チャットリセット: resetChat ? '必須' : '任意'
        });
      }
      
      // モードが変更された場合、または強制更新フラグがある場合、またはチャットリセットが要求された場合に処理を実行
      if (enabled !== isXSearchEnabled || force || resetChat) {
        if (!silentMode) {
          console.log('[Event] モード変更またはリセット要求を検出、チャットを再初期化します');
        }
        
        // 即時更新フラグがある場合は、同期的に処理を実行
        if (immediate && !silentMode) {
          console.log('[Event] 即時更新フラグが検出されました。同期的に処理を実行します');
        }
        
        // 状態を即座に更新（最優先）
        setIsXSearchEnabled(enabled);
        
        // 既存のメッセージをクリア
        if (messages.length > 0) {
          if (!silentMode) {
            console.log(`[Event] 既存のメッセージをクリア（${messages.length}件）`);
          }
          originalSetMessages([]);
        }
        
        // 即座に新しいキーを生成して useChat を強制的に再初期化
        // タイムスタンプをミリ秒単位で含めることで、確実に一意のキーになる
        const timestampValue = Date.now();
        const forcedNewKey = `${id}-${enabled ? 'xsearch' : 'chat'}-${timestampValue}-${resetChat ? 'reset' : (immediate ? 'immediate' : 'forced')}`;
        if (!silentMode) {
          console.log(`[Chat] チャットキーを強制更新: ${forcedNewKey}`);
        }
        setChatKey(forcedNewKey);
        
        // APIを即座に切り替え（同期的に実行）
        if (immediate || resetChat) {
          if (reload) {
            if (!silentMode) {
              console.log(`[Event] useChat のリロードを同期的に実行`);
            }
            try {
              reload({
                data: {
                  chatId: id,
                  model: selectedChatModel,
                  xSearchEnabled: enabled,
                  computerUseEnabled: false,
                  timestamp: timestampValue, // タイムスタンプを含めて確実に再初期化
                  forceReset: true // 強制的にリセットするフラグ
                }
              });
              if (!silentMode) {
                console.log(`[Event] リロード完了: ${enabled ? 'X検索モード' : '通常チャットモード'} が有効になりました`);
              }
            } catch (error) {
              console.error('[X検索] リロードエラー:', error);
              toast.error('モード切替に失敗しました。ページを再読み込みします。');
              window.location.reload();
            }
          } else {
            if (!silentMode) {
              console.warn(`[Event] reloadが利用できません。強制的にページをリロードします`);
            }
            window.location.reload();
          }
        } else {
          // 非同期的に実行（通常のケース）
          setTimeout(() => {
            if (reload) {
              if (!silentMode) {
                console.log(`[Event] useChat のリロードを実行`);
              }
              try {
                reload({
                  data: {
                    chatId: id,
                    model: selectedChatModel,
                    xSearchEnabled: enabled,
                    computerUseEnabled: false,
                    timestamp: timestampValue, // タイムスタンプを含めて確実に再初期化
                    forceReset: true // 強制的にリセットするフラグ
                  }
                });
                if (!silentMode) {
                  console.log(`[Event] リロード完了: ${enabled ? 'X検索モード' : '通常チャットモード'} が有効になりました`);
                }
              } catch (error) {
                console.error('[X検索] リロードエラー:', error);
                toast.error('モード切替に失敗しました。ページを再読み込みします。');
                window.location.reload();
              }
            } else {
              if (!silentMode) {
                console.warn(`[Event] reloadが利用できません。強制的にページをリロードします`);
              }
              window.location.reload();
            }
          }, 0);
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

  const handleSetInput = (newInput: string | ((prevState: string) => string)) => {
    if (typeof newInput === 'function') {
      setInput(newInput);
    } else {
      setInput(newInput);
    }
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
        <div className="size-full max-w-7xl flex flex-row">
          {/* メインコンテンツ領域 */}
          <div className="flex-1 flex flex-col">
            {/* 初期メッセージがある場合は常にMessagesを表示 */}
            {(messages.length === 0 && currentMessages.length === 0) ? (
              <div className="flex-1 flex items-center justify-center">
                <Overview />
              </div>
            ) : (
              <div className="flex-1">
                <Messages
                  chatId={id}
                  isLoading={isLoading}
                  votes={votes}
                  messages={messages.length > 0 ? messages : currentMessages}
                  setMessages={originalSetMessages}
                  reload={reload}
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
                      attachments={attachments}
                      setAttachments={setAttachments}
                      messages={messages}
                      append={append}
                      selectedModelId={selectedChatModel}
                      isXSearchEnabled={isXSearchEnabled}
                      onXSearchToggle={(newValue, silentMode) => {
                        const oldValue = isXSearchEnabled;
                        
                        // silentModeフラグがある場合はログを抑制
                        if (!silentMode) {
                          console.log(`[Parent] X検索ボタンがクリックされました`);
                          console.log(`[Parent] X検索モード変更: ${oldValue ? 'X検索モード' : '通常チャットモード'} → ${newValue ? 'X検索モード' : '通常チャットモード'}`);
                        }
                        
                        // Computer Useモードが有効な場合は無効化
                        if (isComputerUseEnabled) {
                          setIsComputerUseEnabled(false);
                          if (!silentMode) {
                            console.log(`[Parent] Computer Useモードを無効化しました`);
                          }
                        }
                        
                        // 状態を即座に更新（最優先）
                        setIsXSearchEnabled(newValue);
                        if (!silentMode) {
                          console.log(`[Parent] 状態を更新しました: ${newValue}`);
                        }
                        
                        // まず既存のメッセージをクリア（モード切替時は常にチャットをリセット）
                        if (messages.length > 0) {
                          if (!silentMode) {
                            console.log(`[Reset] チャットの状態をリセットします（${messages.length}件のメッセージをクリア）`);
                          }
                          originalSetMessages([]);
                        }
                        
                        // 即座に新しいキーを生成して useChat を強制的に再初期化
                        // タイムスタンプをミリ秒単位で含めることで、確実に一意のキーになる
                        const timestamp = Date.now();
                        const forcedNewKey = `${id}-${newValue ? 'xsearch' : 'chat'}-${timestamp}-reset`;
                        if (!silentMode) {
                          console.log(`[Chat] チャットキーを更新: ${forcedNewKey}`);
                        }
                        setChatKey(forcedNewKey);
                        
                        // APIエンドポイントを即座に切り替える
                        if (!silentMode) {
                          console.log(`[API] エンドポイントを切り替え: ${newValue ? '/api/deep-research/feedback' : '/api/chat'}`);
                        }
                        
                        // useChat を同期的に強制再初期化
                        if (reload) {
                          if (!silentMode) {
                            console.log(`[Refresh] useChat を同期的に再初期化します`);
                          }
                          try {
                            reload({
                              data: {
                                chatId: id,
                                model: selectedChatModel,
                                xSearchEnabled: newValue,
                                computerUseEnabled: false,
                                timestamp: timestamp, // タイムスタンプを含めて確実に再初期化
                                forceReset: true // 強制的にリセットするフラグ
                              }
                            });
                            if (!silentMode) {
                              console.log(`[Refresh] 完了: ${newValue ? 'X検索モード' : '通常チャットモード'} が有効になりました`);
                            }
                          } catch (error) {
                            console.error('[X検索] リロードエラー:', error);
                            toast.error('モード切替に失敗しました。ページを再読み込みします。');
                            window.location.reload();
                          }
                          
                          // 確実に再初期化されたことを確認するためのチェック
                          setTimeout(() => {
                            if (!silentMode) {
                              console.log(`[Verify] チャットの状態を確認: モード=${newValue ? 'X検索' : '通常チャット'}, キー=${forcedNewKey}`);
                            }
                          }, 100);
                        } else {
                          if (!silentMode) {
                            console.warn(`[Refresh] reloadが利用できません。強制的にページをリロードします`);
                          }
                          window.location.reload();
                        }
                      }}
                      isComputerUseEnabled={isComputerUseEnabled}
                      onComputerUseToggle={(newValue) => {
                        const oldValue = isComputerUseEnabled;
                        
                        console.log(`[Parent] Computer Useボタンがクリックされました`);
                        console.log(`[Parent] Computer Useモード変更: ${oldValue ? 'Computer Useモード' : '通常モード'} → ${newValue ? 'Computer Useモード' : '通常モード'}`);
                        
                        // X検索モードが有効な場合は無効化
                        if (isXSearchEnabled) {
                          setIsXSearchEnabled(false);
                          console.log(`[Parent] X検索モードを無効化しました`);
                        }
                        
                        // 状態を即座に更新
                        setIsComputerUseEnabled(newValue);
                        console.log(`[Parent] 状態を更新しました: ${newValue}`);
                        
                        // メッセージをクリア
                        if (messages.length > 0) {
                          console.log(`[Reset] チャットの状態をリセットします（${messages.length}件のメッセージをクリア）`);
                          originalSetMessages([]);
                        }
                        
                        // 新しいキーを生成して useChat を再初期化
                        const timestamp = Date.now();
                        const forcedNewKey = `${id}-${newValue ? 'computer-use' : 'chat'}-${timestamp}-reset`;
                        console.log(`[Chat] チャットキーを更新: ${forcedNewKey}`);
                        setChatKey(forcedNewKey);
                        
                        // APIエンドポイントを切り替え
                        console.log(`[API] エンドポイントを切り替え: ${newValue ? '/api/computer-use' : '/api/chat'}`);
                        
                        // useChat を再初期化
                        if (reload) {
                          console.log(`[Refresh] useChat を再初期化します`);
                          try {
                            reload({
                              data: {
                                chatId: id,
                                model: selectedChatModel,
                                xSearchEnabled: false,
                                computerUseEnabled: newValue,
                                timestamp: timestamp,
                                forceReset: true
                              }
                            });
                            console.log(`[Refresh] 完了: ${newValue ? 'Computer Useモード' : '通常チャットモード'} が有効になりました`);
                          } catch (error) {
                            console.error('[Computer Use] リロードエラー:', error);
                            toast.error('モード切替に失敗しました。ページを再読み込みします。');
                            window.location.reload();
                          }
                        } else {
                          console.warn(`[Refresh] reloadが利用できません。強制的にページをリロードします`);
                          window.location.reload();
                        }
                      }}
                      onShowSearchResults={() => {
                        console.log(`[Chat] 検索結果の表示状態を変更`);
                        setShowReasoningSidebar(true);
                      }}
                      reasoningSteps={reasoningSteps}
                      setReasoningSteps={setReasoningSteps}
                      isReasoningLoading={isReasoningLoading}
                      setIsReasoningLoading={setIsReasoningLoading}
                    />

                    {isArtifactVisible && <Artifact 
                      chatId={id}
                      input={input}
                      setInput={handleSetInput}
                      handleSubmit={async (event, options) => {
                        if (event?.preventDefault) event.preventDefault();
                        await append({
                          id: nanoid(),
                          content: input,
                          role: 'user',
                          createdAt: new Date()
                        }, options);
                        return { success: true };
                      }}
                      isLoading={isLoading}
                      stop={stop}
                      attachments={attachments}
                      setAttachments={setAttachments}
                      messages={messages}
                      setMessages={originalSetMessages}
                      append={append}
                      reload={reload}
                      votes={votes}
                      isReadonly={isReadonly}
                      selectedModelId={selectedChatModel}
                    />}

                    {!isArtifactVisible && messages.length === 0 && (
                      <div className="mb-4">
                        <SuggestedActions
                          chatId={id}
                          append={append}
                          key={isArtifactVisible ? 'artifact' : 'suggested-actions'}
                          suggestions={isArtifactVisible ? [] : getExampleSuggestions(append, handleSetInput)}
                        />
                      </div>
                    )}
                  </>
                )}
              </form>
            </div>
          </div>

          {/* ReasoningSidebar - 右側に表示 */}
          {isXSearchEnabled && showReasoningSidebar && messages.length > 0 && (
            <div className="w-96 border-l border-gray-200 overflow-y-auto h-full">
              <ReasoningSidebar 
                steps={reasoningSteps} 
                isLoading={isReasoningLoading} 
                onClose={() => setShowReasoningSidebar(false)}
              />
            </div>
          )}
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
        ): Promise<{ success: boolean } | undefined> => {
          if (event?.preventDefault) {
            event.preventDefault();
          }
          const message: CreateMessage = {
            id: nanoid(),
            content: input,
            role: 'user',
            createdAt: new Date()
          };
          await append(message, options);
          return { success: true };
        }}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        messages={messages}
        setMessages={originalSetMessages}
        append={append}
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
