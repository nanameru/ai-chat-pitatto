'use client';

import type { Attachment, Message, CreateMessage, ChatRequestOptions } from 'ai';
import { useChat } from '@ai-sdk/react'; // 継続利用。ただし api オプションで自前エンドポイントを指定
import { useEffect, useOptimistic, useState, useRef, useCallback, useTransition } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ReasoningSidebar } from '@/components/reasoning-sidebar';
import { ReasoningStep } from '@/types/reasoning';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { randomUUID } from 'crypto';
import { 
  XMarkIcon, 
  LightBulbIcon,
  ChevronDownIcon as ChevronDown, 
  ChevronUpIcon as ChevronUp,
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  SparklesIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  PuzzlePieceIcon,
  DocumentTextIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

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

// サンプル提案を生成する関数 (Re-add the function)
function getExampleSuggestions(
  append: (message: Message | CreateMessage, options?: ChatRequestOptions) => Promise<string | null | undefined>,
  setInput: (value: string) => void
) {
  return [
    {
      title: 'AIの最新トレンド',
      description: '生成AIの最新技術や研究について教えてください',
      onClick: () => {
        const input = '生成AIの最新技術や研究について教えてください';
        const message = {
          id: randomUUID(),
          content: input,
          role: 'user' as const,
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
          id: randomUUID(),
          content: input,
          role: 'user' as const,
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
          id: randomUUID(),
          content: input,
          role: 'user' as const,
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
          id: randomUUID(),
          content: input,
          role: 'user' as const,
          createdAt: new Date()
        };
        append(message);
        setInput('');
      }
    }
  ];
}

// ToTツール名と対応するReasoningStepタイプ、タイトルプレフィックスのマッピング
const totToolMapping: Record<string, { type: ReasoningStep['type'], titlePrefix: string }> = {
  thoughtGenerator: { type: 'thinking', titlePrefix: '思考生成' },
  thoughtEvaluator: { type: 'thinking', titlePrefix: '思考評価' },
  pathSelector: { type: 'planning', titlePrefix: 'パス選択' },
  researchPlanGenerator: { type: 'planning', titlePrefix: 'リサーチ計画生成' },
  queryOptimizer: { type: 'planning', titlePrefix: 'クエリ最適化' },
  informationEvaluator: { type: 'research', titlePrefix: '情報評価' },
  hypothesisGenerator: { type: 'integration', titlePrefix: '仮説生成' },
  gapAnalyzer: { type: 'research', titlePrefix: 'ギャップ分析' },
  insightExtractor: { type: 'integration', titlePrefix: '洞察抽出' },
  reportGenerator: { type: 'integration', titlePrefix: 'レポート生成' },
  // 必要に応じて他のツールを追加
};

// 個別のToTツール結果をReasoningStepに変換する関数
function convertSingleTotResultToStep(toolName: string, toolResult: any): ReasoningStep | null {
  const mapping = totToolMapping[toolName];
  if (!mapping) {
    console.warn(`[ToT] 未知のツール名: ${toolName}`);
    // 未知のツールでも基本的な情報を表示する試み
    return {
      id: `unknown-${toolName}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      type: 'thinking', // デフォルトタイプ
      title: `未知のツール実行: ${toolName}`,
      content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2).substring(0, 1000) + (JSON.stringify(toolResult).length > 1000 ? '...' : '')
    };
  }

  let content = '';
  try {
    // ツールごとに内容を整形
    if (typeof toolResult === 'string') {
      content = toolResult;
    } else if (typeof toolResult === 'object' && toolResult !== null) {
      // 特定のツールの結果をより分かりやすく整形
      switch (toolName) {
        case 'thoughtGenerator':
          content = (toolResult.thoughts || []).map((t: any, i: number) => `案${i+1}: ${t.content || t.approach || t.idea || JSON.stringify(t)}`).join('\n');
          break;
        case 'thoughtEvaluator':
          content = (toolResult.evaluatedThoughts || []).map((t: any, i: number) => 
            `思考${i+1}: ${t.content || '(内容なし)'}\n` +
            `評価: ${t.score ? Math.round(t.score * 10) / 10 : '?'}/10点\n` +
            `理由: ${t.reasoning ? t.reasoning.split('\n')[0] : '理由なし'}\n`
          ).join('\n\n');
          break;
        case 'pathSelector':
          content = `選択されたパス: ${toolResult.selectedPath?.approach || toolResult.selectedPath?.id || '不明'}\n理由: ${toolResult.reason || '記載なし'}`;
          break;
        case 'researchPlanGenerator':
          content = `トピック: ${toolResult.topic || '未指定'}\nサブトピック:\n${(toolResult.subtopics || []).map((s: string) => `- ${s}`).join('\n')}\nクエリ:\n${(toolResult.queries || []).map((q: string) => `- ${q}`).join('\n')}`;
          break;
        case 'queryOptimizer':
          content = `最適化されたクエリ:\n${(toolResult.optimizedQueries || []).map((q: string) => `- ${q}`).join('\n')}`;
          break;
        case 'informationEvaluator':
          content = `評価ソース数: ${toolResult.evaluatedSources?.length || 0}\n` +
                    `高信頼性: ${toolResult.informationEvaluation?.highReliabilitySources?.length || 0}件\n` +
                    `中信頼性: ${toolResult.informationEvaluation?.mediumReliabilitySources?.length || 0}件\n` +
                    `低信頼性: ${toolResult.informationEvaluation?.lowReliabilitySources?.length || 0}件`;
          break;
        case 'hypothesisGenerator':
          content = (toolResult.hypotheses || []).map((h: any, i: number) => 
            `仮説${i+1}: ${h.statement} (信頼度: ${Math.round((h.confidenceScore || 0) * 100)}%)`
          ).join('\n');
          break;
        case 'gapAnalyzer':
          content = `検出されたギャップ: ${toolResult.informationAnalysis?.informationGaps?.length || 0}件\n` +
                    (toolResult.informationAnalysis?.informationGaps || []).map((g: any) => 
                      `${g.importance === 'high' ? '🔴' : '🟠'} ${g.area}`
                    ).join('\n');
          break;
        case 'insightExtractor':
           content = (toolResult.insights || []).map((ins: any, i: number) => 
            `洞察${i+1}: ${ins.insight} (重要度: ${ins.importance || '中'})`
          ).join('\n');
          break;
        case 'reportGenerator':
          content = (toolResult.finalReport || 'レポート内容なし').substring(0, 500) + ( (toolResult.finalReport?.length || 0) > 500 ? '...' : '');
          break;
        default:
          // その他のツールはJSONをそのまま表示（短縮）
          content = JSON.stringify(toolResult, null, 2).substring(0, 1000) + (JSON.stringify(toolResult).length > 1000 ? '...' : '');
      }
    } else {
      // その他の型はそのまま文字列化
      content = String(toolResult);
    }
  } catch (e) {
    console.error(`[ToT] ステップ内容の整形エラー (${toolName}):`, e);
    content = `結果の表示中にエラー: ${e instanceof Error ? e.message : String(e)}`;
  }

  return {
    id: `${mapping.type}-${toolName}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    type: mapping.type,
    title: `${mapping.titlePrefix}: ${toolName.replace(/([A-Z])/g, ' $1').trim()}`, // CamelCaseをスペース区切りに
    content: content || '結果なし' // contentが空の場合のフォールバック
  };
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
  const refreshParam = searchParams?.get('refresh');

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

  const [isPending, startTransition] = useTransition();

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
    api: isComputerUseEnabled ? '/api/computer-use' : isXSearchEnabled ? '/api/deep-research' : '/api/chat', // サーバープロキシ経由で OpenAI を呼び出すため、useChat の api オプションを設定
    body: {
      ...(chatOptions?.body || {}),
      chatId: id,
      xSearchEnabled: isXSearchEnabled,
      computerUseEnabled: isComputerUseEnabled,
    },
    id: chatKey,
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

  // ★ useOptimistic フックで一時的なメッセージリストを作成
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<Message[], Message>(
    messages, // useChat の messages をベースにする
    (currentState, optimisticValue) => {
      // ★ currentState (useChat の messages) に既に同じIDのメッセージが存在するかチェック
      if (currentState.some(msg => msg.id === optimisticValue.id)) {
        // 存在する場合（実際のデータが useChat から届いた場合）は、
        // オプティミスティックな値を追加せず、現在の状態をそのまま返す
        return currentState;
      } else {
        // 存在しない場合（まだオプティミスティックな状態の場合）は、メッセージを追加
        return [
          ...currentState,
          optimisticValue 
        ];
      }
    }
  );

  // カスタム append 関数 - useOptimistic と startTransition を使用
  const append = useCallback(
    async (message: Message | CreateMessage, options?: ChatRequestOptions) => {
      
      // 1. 送信するユーザーメッセージオブジェクトを作成 (role: 'user')
      const userMessageToAdd: Message = {
        id: typeof message === 'object' && 'id' in message ? (message.id || randomUUID()) : randomUUID(),
        content: typeof message === 'string' ? message : message.content,
        role: 'user' as const,
        createdAt: typeof message === 'object' && 'createdAt' in message ? message.createdAt : new Date()
      };

      // 2. ★ startTransition でラップして optimistic update を実行
      startTransition(() => {
        // ★★★ デバッグログ追加: appendされるメッセージの内容を確認 ★★★
        console.log('[Chat] Optimistically adding message within transition:', {
          id: userMessageToAdd.id,
          role: userMessageToAdd.role, // ← role を確認
          content: typeof userMessageToAdd.content === 'string' ? userMessageToAdd.content.substring(0, 50) + '...' : '[Non-string content]',
          createdAt: userMessageToAdd.createdAt
        });
        // ★★★ ここまで ★★★
        addOptimisticMessage(userMessageToAdd);
      });

      try {
        // 3. useChat の originalAppend を呼び出し (APIリクエスト開始)
        console.log('[Chat] Calling originalAppend to start API request:', message);
        // ★ options に body がなければ空オブジェクトで初期化
        const requestOptions = options || {};
        // ★ body がなければ空オブジェクトで初期化し、既存のbodyとマージして query を追加
        requestOptions.body = {
          ...(requestOptions.body || {}), // 既存の body を維持
          query: typeof message === 'string' ? message : message.content, // ★ input の代わりに message の content を query として渡す
        };
        
        // ★ 修正した requestOptions を渡す
        const result = await originalAppend(message, requestOptions);
        console.log('[Chat] originalAppend finished:', result);
        return result;
      } catch (error) {
        // エラーハンドリング (useOptimistic がロールバックする)
        console.error('[Chat] Error sending message:', {
          error,
          api: isComputerUseEnabled ? '/api/computer-use' : isXSearchEnabled ? '/api/deep-research' : '/api/chat',
          // ... 他のエラー情報 ...
        });
        toast.error('メッセージの送信に失敗しました。');
        throw error; 
      }
    },
    // originalAppend, addOptimisticMessage, startTransition に依存
    [originalAppend, addOptimisticMessage, startTransition, isXSearchEnabled, isComputerUseEnabled]
  );

  // チャットの状態が変わったときに参照を更新
  useEffect(() => {
    updateChatStateRef(messages, input);
  }, [messages, input, updateChatStateRef]);

  // ツール実行ごとの ToT annotation を受信して Sidebar に反映
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (!('annotations' in lastMsg) || !Array.isArray((lastMsg as any).annotations)) return;
    
    // 全アノテーションを調査用にログ
    console.log('[Chat] 受信したアノテーション一覧:', (lastMsg as any).annotations.map((a: any) => a?.type || 'unknown'));
    
    (lastMsg as any).annotations.forEach((a: any) => {
      // tot_reasoning タイプのアノテーション処理
      if (a?.type === 'tot_reasoning' && a.reasoningStep) {
        const step = a.reasoningStep as ReasoningStep;
        setReasoningSteps(prev => prev.some(s => s.id === step.id) ? prev : [...prev, step]);
        setShowReasoningSidebar(true);
        console.log('[Chat] Annotation tot_reasoning received:', step.title);
      }
      
      // reasoning_step タイプのアノテーション処理（代替形式）
      if (a?.type === 'reasoning_step' && a.step) {
        const step = a.step as ReasoningStep;
        setReasoningSteps(prev => prev.some(s => s.id === step.id) ? prev : [...prev, step]);
        setShowReasoningSidebar(true);
        console.log('[Chat] Annotation reasoning_step received:', step.title);
      }
      
      // 一括ステップデータの処理
      if (a?.type === 'reasoning_steps' && Array.isArray(a.reasoningSteps)) {
        console.log('[Chat] Bulk reasoning steps received:', a.reasoningSteps.length);
        setReasoningSteps(prev => {
          // 既存のステップIDを抽出
          const existingIds = new Set(prev.map(s => s.id));
          // 新しいステップを追加（重複を避ける）
          const newSteps = a.reasoningSteps.filter((s: ReasoningStep) => !existingIds.has(s.id));
          return [...prev, ...newSteps];
        });
        setShowReasoningSidebar(true);
      }

      // 最終的なまとめステップの処理
      if (a?.type === 'tot_reasoning_complete' && Array.isArray(a.reasoningSteps)) {
        console.log('[Chat] Final reasoning steps received:', a.reasoningSteps.length);
        setReasoningSteps(prev => {
          // 既存のステップIDを抽出
          const existingIds = new Set(prev.map(s => s.id));
          // 新しいステップを追加（重複を避ける）
          const newSteps = a.reasoningSteps.filter((s: ReasoningStep) => !existingIds.has(s.id));
          return [...prev, ...newSteps];
        });
        setShowReasoningSidebar(true);
      }
    });
  }, [messages]);

  // カスタムイベントをリッスンして、ローカルストレージの値を直接確認
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

  // Deep Research 用の関数
  const executeDeepResearch = async (query: string) => {
    console.log('[Deep Research] 実行開始:', query);
    setIsReasoningLoading(true); // ローディング開始

    try {
      // APIを呼び出し
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          chatId: id,
          model: selectedChatModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '不明なエラーが発生しました' }));
        console.error('[Deep Research] APIエラー:', response.status, errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // ... (data.needsClarification や data.result の処理) ...

    } catch (error) {
      console.error('[Deep Research] 実行エラー:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Deep Research中にエラーが発生しました: ${errorMessage}`);

      // ★ エラーメッセージをチャットに追加して終了 ★
      // addOptimisticMessage は useChat 管理外なので、元の messages 配列を直接操作する
      // （または、useChat の setMessages を使う方が安全かもしれないが、まずはこれで試す）
      // 既存のメッセージ配列を取得 (useChat の内部状態を参照するべきだが、ここでは暫定的に optimisticMessages を使う)
      // ※注意: この方法は useChat の状態と完全に同期しない可能性がある
      const currentMsgs = optimisticMessages; // または chatStateRef.current.messages
      originalSetMessages([
        ...currentMsgs,
        {
            id: randomUUID(),
            role: 'assistant',
            content: `エラーが発生したため、Deep Research を中断しました: ${errorMessage}`,
            createdAt: new Date(),
            annotations: [{ type: 'error', data: { details: errorMessage } }] // エラーを示す注釈
        }
      ]);

    } finally {
      setIsReasoningLoading(false); // ローディング終了
    }
  };

  /* // ★ コメントアウト開始: テスト用ダミーデータ設定部分
  // テスト用: 初期読み込み時にダミーの思考ステップを設定
  useEffect(() => {
    if (isXSearchEnabled) {
      // デバッグ: テスト用の思考ステップを追加
      const testReasoningSteps: ReasoningStep[] = [
        {
          id: 'test-1',
          timestamp: new Date().toISOString(),
          type: 'planning',
          title: 'テスト: 研究計画フェーズを開始',
          content: 'テスト用のダミーデータです。実際の思考プロセスではありません。'
        },
        {
          id: 'test-2',
          timestamp: new Date().toISOString(),
          type: 'thought_generation',
          title: 'テスト: 思考生成を実行',
          content: 'テスト用の思考生成ステップです。'
        }
      ];
      console.log('Setting test reasoning steps for debugging - COMMENTED OUT'); // ログ変更
      // setReasoningSteps(testReasoningSteps); // ★ 状態更新をコメントアウト
      // setIsReasoningLoading(false); // ★ 状態更新をコメントアウト
    }
  }, [isXSearchEnabled]);
  */ // ★ コメントアウト終了

  // ※ 重複処理防止のため、データプロパティのハンドリングは上部の useEffect 内で行います
  // assistant メッセージの最初のトークンを受信したかどうか
  const [hasFirstAssistantToken, setHasFirstAssistantToken] = useState(false);

  // 最新の assistant メッセージにトークンが到達したらフラグを立てる
  useEffect(() => {
    if (messages && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'assistant' && typeof last.content === 'string' && last.content.trim().length > 0) {
        setHasFirstAssistantToken(true);
      }
    }
  }, [messages]);

  // thinking 表示用の統合ローディング状態
  const showThinking = isReasoningLoading || (isLoading && !hasFirstAssistantToken);

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
            {(optimisticMessages.length === 0 && currentMessages.length === 0) ? (
              <div className="flex-1 flex items-center justify-center">
                <Overview />
              </div>
            ) : (
              <div className="flex-1">
                <Messages
                  chatId={id}
                  isLoading={showThinking}
                  votes={votes}
                  messages={optimisticMessages}
                  setMessages={originalSetMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  isArtifactVisible={isArtifactVisible}
                />
              </div>
            )}

            <div className="sticky bottom-0 z-10 bg-background">
              <form className="flex flex-col px-6 md:px-8 bg-background pb-6 md:pb-8 gap-4 w-full" onSubmit={(e) => e.preventDefault()}>
                {!isReadonly && (
                  <>
                    <MultimodalInput
                      chatId={id}
                      input={input}
                      setInput={handleSetInput}
                      isLoading={showThinking}
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
                          console.log(`[API] エンドポイントを切り替え: ${newValue ? '/api/deep-research' : '/api/chat'}`);
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
                    />

                    {isArtifactVisible && <Artifact 
                      chatId={id}
                      input={input}
                      setInput={handleSetInput}
                      handleSubmit={async (event, options) => {
                        if (event?.preventDefault) event.preventDefault();
                        await append({
                          id: randomUUID(),
                          content: input,
                          role: 'user',
                          createdAt: new Date()
                        }, options);
                        return { success: true };
                      }}
                      isLoading={showThinking}
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
                      <div className="mt-8 mb-4">
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
            id: randomUUID(),
            content: input,
            role: 'user',
            createdAt: new Date()
          };
          await append(message, options);
          return { success: true };
        }}
        isLoading={showThinking}
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
