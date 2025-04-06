'use client';

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  memo,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
} from 'react';
import type {
  Attachment,
  ChatRequestOptions as BaseChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';

// ChatRequestOptionsを拡張
interface ChatRequestOptions extends BaseChatRequestOptions {
  xSearchEnabled?: boolean;
  computerUseEnabled?: boolean;
  attachments?: Array<Attachment>;
  id?: string;
}

interface XSearchResponse {
  [key: string]: any;
}

import cx from 'classnames';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import equal from 'fast-deep-equal';
import { nanoid } from 'nanoid';
import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { Search as SearchIcon, Computer } from 'lucide-react';
import { ModelSelector } from './model-selector';
import { generateSubQueries } from '@/lib/ai/x-search/subquery-generator';
import { executeParallelCozeQueries, type FormattedResponse } from '@/lib/ai/coze/coze';
import { ComputerUseToggle } from './computer-use-toggle';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  append,
  className,
  selectedModelId,
  isXSearchEnabled: propIsXSearchEnabled,
  onXSearchToggle,
  onError,
  onShowSearchResults,
  isComputerUseEnabled: propIsComputerUseEnabled,
  onComputerUseToggle,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  append: (
    message: Message | CreateMessage,
    options?: ChatRequestOptions & { xSearchEnabled?: boolean }
  ) => Promise<string | null | undefined>;
  className?: string;
  selectedModelId: string;
  isXSearchEnabled?: boolean;
  onXSearchToggle?: (newValue: boolean, silentMode?: boolean) => void;
  isComputerUseEnabled?: boolean;
  onComputerUseToggle?: (newValue: boolean) => void;
  onError?: (error: Error) => void;
  onShowSearchResults?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  // ローカルストレージの値をバックアップとして使用
  const [localIsXSearchEnabled, setLocalIsXSearchEnabled] = useLocalStorage('searchMode', false);
  const [localIsComputerUseEnabled, setLocalIsComputerUseEnabled] = useLocalStorage('computerUseMode', false);
  
  // 明確化モードの状態管理
  const [clarificationMode, setClarificationMode] = useState<{
    active: boolean;
    originalQuery: string;
  }>({
    active: false,
    originalQuery: ''
  });
  
  // 親コンポーネントから渡された値を優先
  const isXSearchEnabled = propIsXSearchEnabled !== undefined ? propIsXSearchEnabled : localIsXSearchEnabled;
  const isComputerUseEnabled = propIsComputerUseEnabled !== undefined ? propIsComputerUseEnabled : localIsComputerUseEnabled;

  const [isWebSearchEnabled, setIsWebSearchEnabled] = useLocalStorage('isWebSearchEnabled', false);
  
  // WebSearch機能の状態変更をより確実に行うためのハンドラ関数
  const handleWebSearchToggleInternal = useCallback((newState: boolean) => {
    console.log(`[PureMultimodalInput] WebSearch状態を変更: ${isWebSearchEnabled} → ${newState}`);
    
    // LocalStorageに即座に保存して状態の一貫性を確保
    try {
      window.localStorage.setItem('isWebSearchEnabled', JSON.stringify(newState));
      console.log(`[PureMultimodalInput] LocalStorageに保存: isWebSearchEnabled = ${newState}`);
    } catch (error) {
      console.error('[PureMultimodalInput] LocalStorage保存エラー:', error);
    }
    
    // 状態を更新
    setIsWebSearchEnabled(newState);
    
    // カスタムイベントを発火して他のコンポーネントにも通知
    try {
      const event = new CustomEvent('websearch-mode-changed', { 
        detail: { 
          enabled: newState,
          previous: isWebSearchEnabled,
          timestamp: new Date().toISOString(),
          source: 'internal-toggle',
          immediate: true // 即時更新フラグ
        } 
      });
      window.dispatchEvent(event);
      console.log(`[PureMultimodalInput] カスタムイベント発火: websearch-mode-changed`);
    } catch (error) {
      console.error('[PureMultimodalInput] カスタムイベント発火エラー:', error);
    }
    
    // 状態が確実に更新されたことを確認
    setTimeout(() => {
      try {
        const storedValue = JSON.parse(window.localStorage.getItem('isWebSearchEnabled') || 'false');
        console.log(`[PureMultimodalInput] 状態確認: メモリ上=${newState}, LocalStorage=${storedValue}`);
      } catch (e) {
        console.error('[PureMultimodalInput] 状態確認エラー:', e);
      }
    }, 0);
  }, [isWebSearchEnabled, setIsWebSearchEnabled]);

  /**
   * Mastra Deep Research Agent V2を実行する関数
   * @param query ユーザーの入力クエリ
   * @param chatId チャットID
   * @param modelId 選択されたモデルID
   * @param clarificationResponse 明確化質問に対するユーザーの回答（オプション）
   */
  const executeDeepResearchAgent = async (query: string, chatId: string, modelId: string, clarificationResponse?: string) => {
    try {
      toast.info('Deep Research Agentを実行中...', { duration: 3000 });
      console.log('[Deep Research] APIリクエストを開始:', query);
      
      // 処理中の状態を表示
      const loadingMessage: CreateMessage = { 
        id: nanoid(), 
        content: '詳細な調査を実行中...', 
        role: 'assistant' as const, 
        createdAt: new Date() 
      };
      await append(loadingMessage, { id: loadingMessage.id });
      
      // Deep Research APIを呼び出し
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query,
          chatId,
          clarificationResponse // 明確化回答がある場合は送信
        }),
      });
      
      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // APIレスポンスのバリデーション
      // success フィールドが明示的に false の場合のみエラーとして扱う
      if (data.success === false) {
        throw new Error(data.error || 'APIからエラーが返されました');
      }
      
      // データの構造を確認し、必要なフィールドが存在しない場合はデフォルト値を設定
      const validatedData = {
        ...data,
        success: data.success !== false, // 明示的に false でなければ true とみなす
        needsClarification: !!data.needsClarification,
        clarificationMessage: data.clarificationMessage || ''
      };
      
      console.log('[Deep Research] API実行結果:', validatedData);
      
      // 明確化が必要な場合
      if (validatedData.needsClarification && validatedData.clarificationMessage) {
        console.log('[Deep Research] 明確化が必要です:', validatedData.clarificationMessage);
        
        // 前のローディングメッセージを削除
        // Note: この部分は実際のアプリケーションの実装によって異なる場合があります
        
        // 明確化質問を表示
        await append({ 
          id: nanoid(), 
          content: validatedData.clarificationMessage, 
          role: 'assistant' as const, 
          createdAt: new Date() 
        });
        
        // 明確化モードをセット
        setClarificationMode({
          active: true,
          originalQuery: validatedData.originalQuery || query
        });
        
        toast.info('詳細情報を教えてください', { duration: 3000 });
        return;
      }
      
      // 結果を表示
      const resultContent = data.result || JSON.stringify(data);
      
      // 検索オプションを設定
      const options: ChatRequestOptions = {
        xSearchEnabled: true,
        data: {
          searchType: 'deep-research',
          query,
          chatId,
          model: modelId,
          agentResponse: resultContent
        }
      };
      
      // 明確化モードをリセット
      setClarificationMode({
        active: false,
        originalQuery: ''
      });
      
      // ユーザーメッセージを追加
      await append({ 
        id: nanoid(), 
        content: clarificationResponse ? `${query}\n\n${clarificationResponse}` : query, 
        role: 'user' as const, 
        createdAt: new Date() 
      }, options);
      
      // 前のローディングメッセージを削除
      // Note: この部分は実際のアプリケーションの実装によって異なる場合があります
      
      // 最終的な結果を表示
      await append({ 
        id: nanoid(), 
        content: resultContent, 
        role: 'assistant' as const, 
        createdAt: new Date() 
      });
      
      toast.success('Deep Research完了', { duration: 3000 });
    } catch (error) {
      console.error('[Deep Research] 実行中にエラーが発生:', error);
      toast.error('Deep Research処理に失敗しました', { duration: 5000 });
      throw error;
    }
  };

  const handleXSearchToggle = useCallback(() => {
    const oldState = isXSearchEnabled;
    const newState = !oldState;
    
    // モード変更のログ出力を詳細に
    console.log(`----- Deep Researchモード切替 -----`);
    console.log(`Deep Researchボタンがクリックされました`);
    console.log(`モード変更: ${oldState ? 'Deep Researchモード' : '通常チャットモード'} → ${newState ? 'Deep Researchモード' : '通常チャットモード'}`);
    
    // LocalStorageに即座に保存（他のコンポーネントも確実に値を取得できるようにする）
    try {
      window.localStorage.setItem('searchMode', JSON.stringify(newState));
      console.log(`[Deep Research] LocalStorageに値を保存しました: ${newState}`);
    } catch (error) {
      console.error(`[Deep Research] LocalStorageへの保存に失敗しました:`, error);
    }
    
    // ローカルの状態を即座に更新
    setLocalIsXSearchEnabled(newState);
    
    // カスタムイベントを即座に発火して他のコンポーネントに通知
    try {
      const event = new CustomEvent('xsearch-mode-changed', { 
        detail: { 
          enabled: newState,
          previous: oldState,
          timestamp: new Date().toLocaleTimeString(),
          force: true, // 強制的に更新するフラグを追加
          immediate: true // 即時更新フラグを追加
        } 
      });
      window.dispatchEvent(event);
      console.log(`[Deep Research] カスタムイベントを発火しました（即時更新）`);
    } catch (error) {
      console.error(`[Deep Research] カスタムイベント発火に失敗しました:`, error);
    }
    
    // 親コンポーネントのコールバックを同期的に呼び出す
    if (onXSearchToggle) {
      console.log(`[Deep Research] 親コンポーネントにモード変更を通知: ${oldState ? 'Deep Researchモード' : '通常チャットモード'} → ${newState ? 'Deep Researchモード' : '通常チャットモード'}`);
      onXSearchToggle(newState);
    }
    
    console.log(`----- Deep Researchモード切替完了 -----`);
    
    // 状態が確実に更新されたことを確認するためのチェック
    setTimeout(() => {
      const currentStorageValue = window.localStorage.getItem('searchMode');
      console.log(`[Deep Research] 状態確認: LocalStorage=${currentStorageValue}, ローカル状態=${newState}`);
      
      // Deep Researchモードが有効になった場合は自動的にMastraエージェントを実行
      if (newState && input.trim()) {
        console.log(`[Deep Research] モード切替時に自動実行を開始`);
        executeDeepResearchAgent(input, chatId, selectedModelId)
          .then(() => {
            console.log(`[Deep Research] モード切替時の自動実行が完了しました`);
          })
          .catch((error) => {
            console.error(`[Deep Research] モード切替時の自動実行中にエラーが発生しました:`, error);
          });
      } else if (newState) {
        console.log(`[Deep Research] 入力が空のため、自動実行をスキップしました`);
        toast.info('入力を入力して送信するとDeep Researchが実行されます', { duration: 5000 });
      }
    }, 0);
  }, [isXSearchEnabled, setLocalIsXSearchEnabled, onXSearchToggle, input, chatId, selectedModelId, append]);

  const handleWebSearchToggle = useCallback(() => {
    const oldState = isWebSearchEnabled;
    const newState = !oldState;
    
    console.log(`----- 検索モード切替 -----`);
    console.log(`検索ボタンがクリックされました`);
    console.log(`モード変更: ${oldState ? '検索モード' : '通常チャットモード'} → ${newState ? '検索モード' : '通常チャットモード'}`);
    
    // 状態を更新（内部ハンドラを使用）
    handleWebSearchToggleInternal(newState);
    
    // トースト通知
    toast.success(`${newState ? '検索モード' : '通常チャットモード'}に切り替えました`, {
      duration: 3000,
    });
    
    // LocalStorageの値が確実に更新されたことを確認するためのログ
    setTimeout(() => {
      try {
        const storedValue = JSON.parse(window.localStorage.getItem('isWebSearchEnabled') || 'false');
        console.log(`[WebSearch] LocalStorage確認: isWebSearchEnabled = ${storedValue}`);
      } catch (e) {
        console.error('[WebSearch] LocalStorage確認エラー:', e);
      }
    }, 0);
    
    console.log(`----- 検索モード切替完了 -----`);
  }, [isWebSearchEnabled, handleWebSearchToggleInternal]);

  const handleXSearchSubmit = async (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions
  ) => {
    console.log('[Deep Research] Deep Research処理を実行');
    
    try {
      const options: ChatRequestOptions = {
        ...chatRequestOptions,
        xSearchEnabled: true
      };
      
      return await append({ id: nanoid(), content: input, role: 'user', createdAt: new Date() }, options);
    } catch (error) {
      console.error('[Deep Research] Deep Research処理でエラーが発生:', error);
      throw error;
    }
  };

  const handleNormalChatSubmit = async (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions
  ) => {
    console.log('[Chat] 通常チャット処理を実行');
    
    try {
      const options: ChatRequestOptions = {
        ...chatRequestOptions,
        xSearchEnabled: false
      };
      
      return await append({ id: nanoid(), content: input, role: 'user', createdAt: new Date() }, options);
    } catch (error) {
      console.error('[Chat] 通常チャット処理でエラーが発生:', error);
      throw error;
    }
  };

  const handleSubmitWithLogging = useCallback(
    async (event?: { preventDefault?: () => void }, chatRequestOptions?: ChatRequestOptions) => {
      if (event?.preventDefault) {
        event.preventDefault();
      }

      if (isLoading) return;

      // 送信時に即座に入力フィールドをクリア
      const currentInput = input;
      setInput('');
      setLocalStorageInput('');

      // 親コンポーネントから渡された値を優先的に使用
      const effectiveXSearchEnabled = propIsXSearchEnabled !== undefined ? propIsXSearchEnabled : isXSearchEnabled;
      const currentMode = effectiveXSearchEnabled ? 'Deep Researchモード' : isWebSearchEnabled ? '検索モード' : 'チャットモード';
      console.log('[Submit] 送信を開始します:', { currentMode, currentInput });

      try {
        // 共通のオプション
        const options: ChatRequestOptions = {
          ...chatRequestOptions,
          xSearchEnabled: effectiveXSearchEnabled,
          data: {
            ...((chatRequestOptions?.data as Record<string, unknown>) || {}),
            chatId,
            model: selectedModelId,
            xSearchEnabled: effectiveXSearchEnabled,
            preserveMessages: true // 既存のメッセージを保持するフラグを追加
          }
        };

        // メッセージを作成
        const message: CreateMessage = {
          id: nanoid(),
          content: currentInput, // 保存したinputの値を使用
          role: 'user',
          createdAt: new Date()
        };

        // UIにユーザーメッセージを追加し、AIの応答を取得する
        // appendはすでにAPIを呼び出すので、二重に呼び出さない
        console.log('[Submit] appendを呼び出します');
        const result = await append(message, options);
        console.log('[Submit] append完了:', result);

        return { success: true };
      } catch (error) {
        console.error('[Error] 処理中にエラーが発生:', error);
        onError?.(error as Error);
        return { error };
      }
    },
    [propIsXSearchEnabled, isXSearchEnabled, isWebSearchEnabled, input, isLoading, chatId, selectedModelId, append, onError, setInput, setLocalStorageInput, isComputerUseEnabled, propIsComputerUseEnabled]
  );

  const submitForm = useCallback(async () => {
    // 親コンポーネントから渡された値を優先的に使用
    const effectiveXSearchEnabled = propIsXSearchEnabled !== undefined ? propIsXSearchEnabled : isXSearchEnabled;
    const effectiveComputerUseEnabled = propIsComputerUseEnabled !== undefined ? propIsComputerUseEnabled : isComputerUseEnabled;
    
    console.log('[Submit] フォーム送信を開始:', {
      mode: effectiveComputerUseEnabled ? 'Computer Use' : effectiveXSearchEnabled ? 'Deep Research' : isWebSearchEnabled ? '検索' : '通常チャット',
      input,
      attachments,
      clarificationMode
    });

    try {
      const currentInput = input;
      const currentAttachments = [...attachments];

      // 送信時に即座に入力フィールドとファイル添付をクリア
      setInput('');
      setLocalStorageInput('');
      setAttachments([]);

      if (currentInput.trim() || currentAttachments.length > 0) {
        // 明確化モードが有効な場合、元のクエリと明確化回答を使用してDeep Researchを実行
        if (clarificationMode.active) {
          console.log('[Clarification] 明確化回答を使用してDeep Research処理を実行:', {
            originalQuery: clarificationMode.originalQuery,
            clarificationResponse: currentInput
          });
          
          try {
            // Deep Research Agent V2を実行（明確化回答付き）
            await executeDeepResearchAgent(clarificationMode.originalQuery, chatId, selectedModelId, currentInput);
            return { success: true };
          } catch (error) {
            console.error('[Clarification] 処理中にエラーが発生:', error);
            toast.error('Deep Research処理中にエラーが発生しました', { duration: 3000 });
            onError?.(error as Error);
            return { error };
          }
        }
        
        // Computer Use モードが有効な場合、他のモードよりも優先する
        if (effectiveComputerUseEnabled) {
          console.log('[Computer Use] Computer Use処理を実行');
          toast.info('コンピュータ操作モードで実行中...', { duration: 3000 });
          
          try {
            // Computer Use用のオプションを設定
            const options: ChatRequestOptions = {
              computerUseEnabled: true,
              data: {
                chatId,
                model: 'claude-computer-use',
                computerUseEnabled: true
              }
            };
            
            // ユーザーメッセージを追加
            await append({
              id: nanoid(),
              content: currentInput,
              role: 'user',
              createdAt: new Date()
            }, options);
            
            return { success: true };
          } catch (error) {
            console.error('[Computer Use] 処理中にエラーが発生:', error);
            toast.error('コンピュータ操作処理中にエラーが発生しました', { duration: 3000 });
            onError?.(error as Error);
            return { error };
          }
        }
        
        // Deep Research モードが有効な場合
        if (effectiveXSearchEnabled && !effectiveComputerUseEnabled) {
          console.log('[Deep Research] Deep Research処理を実行');
          toast.info('Deep Research処理を実行中...', { duration: 3000 });
          
          try {
            // Deep Research Agent V2を実行
            await executeDeepResearchAgent(currentInput, chatId, selectedModelId);
            return { success: true };
          } catch (error) {
            console.error('[Deep Research] 処理中にエラーが発生:', error);
            toast.error('Deep Research処理中にエラーが発生しました', { duration: 3000 });
            onError?.(error as Error);
            return { error };
          }
        }
        
        // WebSearch モードが有効な場合
        console.log('[WebSearch] モード確認:', { 
          isWebSearchEnabled, 
          effectiveXSearchEnabled,
          effectiveComputerUseEnabled,
          condition: isWebSearchEnabled && !effectiveXSearchEnabled && !effectiveComputerUseEnabled,
          input: currentInput
        });
        
        // WebSearchモードの状態を再確認（LocalStorageから直接取得して最新の状態を確保）
        let currentWebSearchEnabled = isWebSearchEnabled;
        try {
          const storedValue = JSON.parse(window.localStorage.getItem('isWebSearchEnabled') || 'false');
          if (storedValue !== currentWebSearchEnabled) {
            console.log(`[WebSearch] 状態の不一致を検出: メモリ上=${currentWebSearchEnabled}, LocalStorage=${storedValue}`);
            currentWebSearchEnabled = storedValue;
          }
        } catch (e) {
          console.error('[WebSearch] LocalStorage確認エラー:', e);
        }
        
        console.log('[WebSearch] 最終状態確認:', { 
          isWebSearchEnabled, 
          currentWebSearchEnabled,
          effectiveXSearchEnabled, 
          condition: currentWebSearchEnabled && !effectiveXSearchEnabled,
          input: currentInput
        });
        
        if (currentWebSearchEnabled && !effectiveXSearchEnabled && !effectiveComputerUseEnabled) {
          console.log('[WebSearch] 検索処理を実行');
          
          try {
            // サブクエリを生成
            console.log('[WebSearch] サブクエリの生成を開始:', currentInput);
            console.log('[WebSearch] Gemini APIキー確認:', process.env.GEMINI_API_KEY ? '設定されています' : '設定されていません');
            toast.info('サブクエリを生成中...', { duration: 3000 });
            
            // サブクエリ生成前に状態を再確認
            console.log('[WebSearch] サブクエリ生成前の状態確認:', { 
              currentWebSearchEnabled,
              localStorageValue: (() => {
                try {
                  return JSON.parse(window.localStorage.getItem('isWebSearchEnabled') || 'false');
                } catch (e) {
                  return 'エラー';
                }
              })()
            });
            
            try {
              // サブクエリ生成を確実に実行
              const subQueries = await generateSubQueries(currentInput);
              console.log('[WebSearch] generateSubQueries 結果:', subQueries);
            
            if (subQueries && subQueries.length > 0) {
              console.log(`[WebSearch] ${subQueries.length}個のサブクエリを生成しました:`, subQueries);
              toast.success(`${subQueries.length}個のサブクエリを生成しました`, { duration: 3000 });
              
              // 並列実行の進捗を表示するためのコールバック
              const onProgress = (processed: number) => {
                console.log(`[WebSearch] 進捗: ${processed}/${subQueries.length} クエリを処理`);
                toast.info(`検索実行中: ${processed}/${subQueries.length}`, { duration: 1500 });
              };
              
              // サブクエリを並列実行
              console.log(`[WebSearch] サブクエリの並列実行を開始します`);
              const results = await executeParallelCozeQueries(subQueries, chatId, 'user-query', onProgress);
              
              // 結果をログに出力
              console.log(`[WebSearch] 検索結果:`, results.map(r => ({
                query: r.query,
                postsCount: r.posts?.length || 0,
                hasError: !!r.error
              })));
              
              // 成功メッセージを表示
              const totalPosts = results.reduce((sum, r) => sum + (r.posts?.length || 0), 0);
              toast.success(`${results.length}個のクエリから${totalPosts}件の結果を取得しました`, { duration: 5000 });
              
              // 通常のチャット処理を続行
              // undefined値をJSONValue型と互換性のある形式に変換
              const toJSONSafe = (obj: any): any => {
                if (obj === null || obj === undefined) {
                  return null; // undefinedをnullに変換
                }
                
                if (Array.isArray(obj)) {
                  return obj.map(item => toJSONSafe(item));
                }
                
                if (typeof obj === 'object') {
                  const result: Record<string, any> = {};
                  for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                      result[key] = toJSONSafe(obj[key]);
                    }
                  }
                  return result;
                }
                
                return obj;
              };
              
              const serializedResults = results.map(result => {
                const jsonSafeResult: Record<string, any> = {
                  query: result.query,
                  posts: toJSONSafe(result.posts),
                  metadata: toJSONSafe(result.metadata)
                };
                
                // errorプロパティが存在する場合のみ追加
                if (result.error) {
                  jsonSafeResult.error = String(result.error);
                }
                
                return jsonSafeResult;
              });
              
              await handleSubmitWithLogging(undefined, {
                data: {
                  webSearchResults: serializedResults,
                  webSearchEnabled: true
                }
              });
              
              return { success: true };
            } else {
              console.warn(`[WebSearch] サブクエリの生成に失敗しました: 空の配列または未定義が返されました`);
              toast.error('サブクエリの生成に失敗しました', { duration: 3000 });
              
              // 通常のチャット処理を続行
              await handleSubmitWithLogging();
            }
            } catch (subQueryError) {
              console.error(`[WebSearch] サブクエリ生成中にエラーが発生:`, subQueryError);
              toast.error('サブクエリの生成中にエラーが発生しました', { duration: 3000 });
              
              // 通常のチャット処理を続行
              await handleSubmitWithLogging();
            }
          } catch (error) {
            console.error(`[WebSearch] 検索処理全体でエラーが発生しました:`, error);
            toast.error('検索処理中にエラーが発生しました', { duration: 3000 });
            
            // エラーが発生しても通常のチャット処理を続行
            await handleSubmitWithLogging();
          }
        }
        // X検索モードが有効な場合はX検索を実行（Computer Useモードが無効の場合）
        else if (effectiveXSearchEnabled && !effectiveComputerUseEnabled) {
          console.log('[Deep Research] Deep Research処理を実行');
          
          try {
            // Mastra Deep Research Agent V2を実行
            await executeDeepResearchAgent(currentInput, chatId, selectedModelId);
          } catch (error) {
            console.error('[Deep Research] Deep Research処理でエラーが発生:', error);
            toast.error('Deep Research処理に失敗しました');
            throw error;
          }
          return;
        }
        
        // 通常の検索モードが有効な場合は検索を実行
        if (isWebSearchEnabled && !effectiveXSearchEnabled) {
          console.log('[検索] 検索処理を実行');
          
          try {
            // サブクエリを生成
            console.log('[検索] サブクエリの生成を開始:', currentInput);
            const subQueries = await generateSubQueries(currentInput);
            console.log('[検索] 生成されたサブクエリ:', subQueries);
            
            // 結果をトーストで表示
            toast.success(`${subQueries.length}個のサブクエリが生成されました`, {
              description: subQueries.slice(0, 3).join(', ') + (subQueries.length > 3 ? '...' : '')
            });
            
            // 検索オプションを設定
            const options: ChatRequestOptions = {
              data: {
                searchType: 'web',
                query: currentInput,
                isWebSearchEnabled: true,
                chatId,
                model: selectedModelId,
                subQueries: subQueries // サブクエリを追加
              }
            };
            
            await append({ id: nanoid(), content: currentInput, role: 'user', createdAt: new Date() }, options);
          } catch (error) {
            console.error('[検索] 検索処理でエラーが発生:', error);
            toast.error('検索処理に失敗しました');
            throw error;
          }
          return;
        }
        
        // 画像生成コマンドの検出
        // 日本語と英語の様々なコマンド形式に対応
        console.log('[デバッグ] 入力テキスト:', currentInput);
        console.log('[デバッグ] 選択されたモデル:', selectedModelId);
        
        const imageCommandPatterns = [
          /^\/image\s+(.+)$/i,                    // /image [prompt]
          /^generate\s+image[:\s]+(.+)$/i,        // generate image: [prompt]
          /^create\s+image[:\s]+(.+)$/i,          // create image: [prompt]
          /^draw[:\s]+(.+)$/i,                    // draw: [prompt]
          /^画像を生成して[:\s]+(.+)$/i,      // 画像を生成して: [prompt]
          /^画像生成[:\s]+(.+)$/i,              // 画像生成: [prompt]
        ];
        
        // 各パターンでマッチングを試みる
        let imagePrompt: string | null = null;
        let matchedPattern: string | null = null;
        
        for (const pattern of imageCommandPatterns) {
          console.log('[デバッグ] パターンチェック:', pattern);
          const match = currentInput.match(pattern);
          if (match) {
            imagePrompt = match[1].trim();
            matchedPattern = pattern.toString();
            console.log('[デバッグ] マッチしました! パターン:', matchedPattern, 'プロンプト:', imagePrompt);
            break;
          }
        }
        
        console.log('[デバッグ] 画像プロンプトの検出結果:', imagePrompt ? '検出されました' : '検出されませんでした');
        
        // 選択されたモデルがGrokモデルであるか確認
        const isGrokModel = selectedModelId === 'grok-vision-model' || selectedModelId === 'grok-model';
        console.log('[デバッグ] Grokモデルかどうか:', isGrokModel ? 'はい' : 'いいえ');
        
        // 画像生成コマンドが検出された場合の処理
        // どのモデルが選択されていても画像生成コマンドを処理
        if (imagePrompt) {
          console.log('[デバッグ] 画像生成コマンドが検出されました');
          
          // 強制的に画像生成モードを有効化
          toast.info('画像生成コマンドを検出しました: ' + imagePrompt);
          
          try {
            console.log('[画像生成] 画像生成コマンドを検出:', imagePrompt);
            toast.info('画像を生成中...', { duration: 5000 });
            
            // 画像生成リクエストのオプション
            const options: ChatRequestOptions = {
              data: {
                command: 'generate-image',
                prompt: imagePrompt,
                // 選択されたモデルがGrokモデルならそれを使用、そうでなければDALL-Eを使用
                model: isGrokModel ? 'grok-image-model' : 'large-model',
                chatId,
                selectedModelId, // 選択されたモデルIDも送信
                forceImageGeneration: true, // 強制的に画像生成モードを有効化
                useDirectImageGeneration: true, // 直接画像生成を使用
              }
            };
            
            console.log('[デバッグ] 画像生成リクエストオプション:', options);
            
            // ユーザーメッセージを追加
            await append({ 
              id: nanoid(), 
              content: currentInput, 
              role: 'user', 
              createdAt: new Date() 
            }, options);
            
            return;
          } catch (error) {
            console.error('[画像生成] エラー:', error);
            toast.error('画像生成に失敗しました');
            onError?.(error instanceof Error ? error : new Error(String(error)));
          }
        }
        
        // 共通のオプション
        const options: ChatRequestOptions = {
          xSearchEnabled: effectiveXSearchEnabled,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
          data: {
            chatId,
            model: selectedModelId
          }
        };

        // 直接handleSubmitWithLoggingを呼び出す
        await handleSubmitWithLogging(undefined, options);
      }
    } catch (error) {
      console.error('[Error] フォーム送信中にエラーが発生:', error);
      toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
    }
  }, [
    input,
    attachments,
    chatId,
    isXSearchEnabled,
    isWebSearchEnabled,
    propIsXSearchEnabled,
    handleSubmitWithLogging,
    setAttachments,
    setInput,
    setLocalStorageInput,
    selectedModelId,
    append
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log(`ファイルをアップロード中: ${file.name} (${file.size} bytes)`);
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include', // 認証情報（Cookie）を送信
      });

      // レスポンスの詳細をログに出力
      console.log('レスポンスステータス:', response.status);
      console.log('レスポンスヘッダー:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('ファイルアップロード成功:', data);
        console.log('=== クライアント側: アップロード成功 ===');
        console.log('ファイル名:', data.pathname);
        console.log('コンテンツタイプ:', data.contentType);
        console.log('公開URL:', data.url);
        console.log('公開URLをクリックして確認できます:', data.url);
        console.log('====================================');
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      
      // エラーレスポンスの詳細を取得
      let errorMessage = 'ファイルのアップロードに失敗しました';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        console.error('エラーレスポンスの詳細:', errorData);
      } catch (e) {
        console.error('エラーレスポンスの解析に失敗:', e);
      }
      
      console.error(`アップロードエラー (${response.status}): ${errorMessage}`);
      toast.error(errorMessage);
      return undefined;
    } catch (error) {
      console.error('ファイルアップロード例外:', error);
      toast.error('ファイルのアップロードに失敗しました。ネットワーク接続を確認してください。');
      return undefined;
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
        // ファイル選択をリセットして同じファイルを再度選択できるようにする
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [setAttachments, fileInputRef],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing && // IME入力中は送信しない
        !isLoading
      ) {
        event.preventDefault();
        submitForm();
      }
    },
    [isLoading, submitForm],
  );

  // 添付ファイルを削除する関数を追加
  const handleDeleteAttachment = (index: number) => {
    setAttachments((prev) => {
      const newAttachments = [...prev];
      newAttachments.splice(index, 1);
      return newAttachments;
    });
    
    // ファイル選択をリセットして同じファイルを再度選択できるようにする
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions append={append} chatId={chatId} />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-row gap-2 overflow-x-scroll items-end">
          {attachments.map((attachment, index) => (
            <PreviewAttachment 
              key={attachment.url} 
              attachment={attachment} 
              onDelete={() => handleDeleteAttachment(index)}
            />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <div className="relative max-w-[768px] md:max-w-[768px] sm:max-w-[640px] mx-auto w-full">
        <Textarea
          ref={textareaRef}
          placeholder="Pitatto AIにメッセージを送信する"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          className={cx(
            'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-3xl !text-base bg-white py-4 pb-14 px-5 border border-gray-200 focus:border-gray-200 !focus-visible:ring-0 !focus-visible:ring-offset-0 focus:outline-none shadow-[0_2px_12px_0_rgba(0,0,0,0.08)] dark:bg-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-700 dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.2)]',
            className,
          )}
          rows={2}
          autoFocus
        />

        <div className="absolute bottom-0 p-4 w-fit flex flex-row justify-start items-center gap-2">
          <Button
            type="button"
            className="size-8 rounded-full text-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 flex items-center justify-center"
            onClick={(event) => {
              event.preventDefault();
              fileInputRef.current?.click();
            }}
            disabled={isLoading}
            aria-label="ファイルを添付"
          >
            <PaperclipIcon size={16} />
          </Button>
          <WebSearchButton 
            onClick={handleWebSearchToggle} 
            isLoading={isLoading} 
            input={input} 
            isEnabled={isWebSearchEnabled} 
            onToggle={handleWebSearchToggleInternal} 
          />
          <XSearchButton
            initialValue={isXSearchEnabled}
            onXSearchToggle={onXSearchToggle || ((enabled, silentMode) => {
              console.log('[MultimodalInput] onXSearchToggle が未定義のため、デフォルト処理を実行します');
            })}
          />
          {messages.length > 0 && onShowSearchResults && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  className="size-8 rounded-full text-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 flex items-center justify-center"
                  onClick={() => onShowSearchResults()}
                  aria-label="検索結果を表示"
                >
                  <SearchIcon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>検索結果を表示</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="absolute bottom-0 right-0 p-4 w-fit flex flex-row justify-end items-center gap-2">
          <ModelSelector selectedModelId={selectedModelId} className="mr-1" />
          {isLoading ? (
            <StopButton stop={stop} />
          ) : (
            <SendButton
              input={input}
              submitForm={handleSubmitWithLogging}
              uploadQueue={uploadQueue}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;

    return true;
  },
);

MultimodalInput.displayName = 'MultimodalInput';

const PureWebSearchButton = memo(function PureWebSearchButton({ 
  onClick, 
  isLoading, 
  input, 
  isEnabled, 
  onToggle 
}: { 
  onClick: () => void; 
  isLoading: boolean; 
  input: string;
  isEnabled: boolean;
  onToggle: (newState: boolean) => void;
}) {
  // クライアント側の状態を管理（サーバーレンダリング用にデフォルト値はfalse）
  // 親コンポーネントから渡されたisEnabledを初期値として使用
  const [clientSideEnabled, setClientSideEnabled] = useState(false);
  
  // マウント後、親から渡された値に合わせて状態を更新
  // ハイドレーションの不一致を避けるためにタイマーを使用
  useEffect(() => {
    const timer = setTimeout(() => {
      setClientSideEnabled(isEnabled);
    }, 0);
    return () => clearTimeout(timer);
  }, [isEnabled]);
  
  const handleButtonClick = useCallback(async () => {
    // 親コンポーネントから渡された現在の状態を使用
    const currentState = isEnabled;
    const newState = !currentState;
    
    console.log(`[PureWebSearchButton] ボタンがクリックされました: ${currentState ? '検索モード' : '通常チャットモード'} → ${newState ? '検索モード' : '通常チャットモード'}`);
    
    // 即座に状態を更新して視覚的なフィードバックを提供
    setClientSideEnabled(newState);
    
    // LocalStorageに直接保存して状態の一貫性を確保
    try {
      window.localStorage.setItem('isWebSearchEnabled', JSON.stringify(newState));
      console.log(`[PureWebSearchButton] LocalStorageに直接保存: isWebSearchEnabled = ${newState}`);
    } catch (error) {
      console.error('[PureWebSearchButton] LocalStorage保存エラー:', error);
    }
    
    // カスタムイベントを発火して他のコンポーネントにも即座に通知
    try {
      const event = new CustomEvent('websearch-mode-changed', { 
        detail: { 
          enabled: newState,
          previous: currentState,
          timestamp: new Date().toISOString(),
          source: 'button-click',
          immediate: true // 即時更新フラグ
        } 
      });
      window.dispatchEvent(event);
      console.log(`[PureWebSearchButton] カスタムイベント発火: websearch-mode-changed`);
    } catch (error) {
      console.error('[PureWebSearchButton] カスタムイベント発火エラー:', error);
    }
    
    // 親コンポーネントの状態を更新するコールバックを呼び出し
    onToggle(newState);
    
    // 親コンポーネントのハンドラを呼び出し
    onClick();
    
    // 状態が確実に更新されたことを確認
    console.log(`[PureWebSearchButton] モード切替完了: ${newState ? '検索モード' : '通常チャットモード'}`);
    
    // LocalStorageの値を確認（デバッグ用）
    setTimeout(() => {
      try {
        const storedValue = JSON.parse(window.localStorage.getItem('isWebSearchEnabled') || 'false');
        console.log(`[PureWebSearchButton] LocalStorage確認: isWebSearchEnabled = ${storedValue}`);
      } catch (e) {
        console.error('[PureWebSearchButton] LocalStorage確認エラー:', e);
      }
    }, 10);
  }, [isEnabled, onClick, onToggle]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={handleButtonClick}
            disabled={isLoading}
            className={cx(
              "h-8 px-4 rounded-full text-sm flex items-center gap-2 transition-colors duration-200",
              clientSideEnabled
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border-transparent"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            )}
            aria-label="検索"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.6001 9H20.4001" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.6001 15H20.4001" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 3C14.5 7.5 14.5 16.5 12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 3C9.5 7.5 9.5 16.5 12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>検索</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{clientSideEnabled ? "検索モード中 - クリックで通常モードに戻す" : "検索モードに切り替え"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

PureWebSearchButton.displayName = 'PureWebSearchButton';

const WebSearchButton = memo(function WebSearchButton({ 
  onClick, 
  isLoading, 
  input, 
  isEnabled, 
  onToggle 
}: { 
  onClick: () => void; 
  isLoading: boolean; 
  input: string;
  isEnabled: boolean;
  onToggle: (newState: boolean) => void;
}) {
  return <PureWebSearchButton 
    onClick={onClick} 
    isLoading={isLoading} 
    input={input} 
    isEnabled={isEnabled} 
    onToggle={onToggle} 
  />;
});
WebSearchButton.displayName = 'WebSearchButton';

const PureXSearchButton = memo(function PureXSearchButton({
  initialValue = false,
  onXSearchToggle
}: {
  initialValue?: boolean;
  onXSearchToggle: (enabled: boolean, silentMode?: boolean) => void;
}) {
  // クライアント側の状態を管理（サーバーレンダリング用にデフォルト値はfalse）
  const [clientSideEnabled, setClientSideEnabled] = useState(initialValue);
  
  // マウント後、propsの値に合わせて状態を更新
  // クライアントサイドでのみ状態を更新
  useEffect(() => {
    // ハイドレーション後に状態を更新
    const timer = setTimeout(() => {
      setClientSideEnabled(initialValue);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialValue]);
  
  // ボタンの状態を視覚的に表示するためのクラス
  // 注意: サーバーサイドレンダリングとクライアントサイドレンダリングで一致させるため
  // 動的な値を使わず、固定のクラス名を使用する
  const buttonClass = "h-8 px-4 rounded-full text-sm border flex items-center gap-2 transition-colors duration-200 bg-white text-gray-700 hover:bg-gray-100 border-gray-200";
  
  const handleButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    // 現在の状態を取得
    const currentState = clientSideEnabled;
    const newState = !currentState;
    
    console.log(`[PureXSearchButton] ボタンがクリックされました: ${currentState ? 'Deep Researchモード' : '通常チャットモード'} → ${newState ? 'Deep Researchモード' : '通常チャットモード'}`);
    
    // 即座に状態を更新して視覚的なフィードバックを提供
    setClientSideEnabled(newState);
    
    // LocalStorageに即座に保存
    try {
      window.localStorage.setItem('searchMode', JSON.stringify(newState));
    } catch (error) {
      // エラーログは表示しない
    }
    
    // カスタムイベントを即座に発火（親コンポーネントのコールバックより先に）
    try {
      const event = new CustomEvent('xsearch-mode-changed', { 
        detail: { 
          enabled: newState,
          previous: currentState,
          timestamp: new Date().toISOString(),
          force: true,
          immediate: true,
          source: 'button-click',
          resetChat: true, // useChatを確実に初期化するフラグ
          silentMode: true // ログを抑制するフラグ
        } 
      });
      window.dispatchEvent(event);
    } catch (error) {
      // エラーログは表示しない
    }
    
    // 親コンポーネントのハンドラを呼び出し
    onXSearchToggle(newState, true);
    
    // 状態が確実に更新されたことを確認
    console.log(`[PureXSearchButton] モード切替完了: ${newState ? 'Deep Researchモード' : '通常チャットモード'}`);
    
    // LocalStorageの値を確認（デバッグ用）
    setTimeout(() => {
      const currentStorageValue = window.localStorage.getItem('searchMode');
      console.log(`[PureXSearchButton] 状態確認: LocalStorage=${currentStorageValue}, ローカル状態=${newState}`);
    }, 0);
  }, [clientSideEnabled, onXSearchToggle]);
  
  const onClick = useCallback(() => {
    // 親コンポーネントのコールバックを呼び出し
    onXSearchToggle(clientSideEnabled, true); // silentModeフラグを追加
  }, [clientSideEnabled, onXSearchToggle]);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={handleButtonClick}
            disabled={false}
            suppressHydrationWarning
            className={typeof window !== 'undefined' ? cx(
              "h-8 px-4 rounded-full text-sm flex items-center gap-2 transition-colors duration-200",
              clientSideEnabled
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border-transparent"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            ) : "h-8 px-4 rounded-full text-sm flex items-center gap-2 transition-colors duration-200 bg-white text-gray-700 border border-gray-200"}
            aria-label="Deep Research"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 self-center" style={{ transform: 'translateY(-1px)' }}>
              <path fillRule="evenodd" clipRule="evenodd" d="M8.40706 4.92939L8.5 4H9.5L9.59294 4.92939C9.82973 7.29734 11.7027 9.17027 14.0706 9.40706L15 9.5V10.5L14.0706 10.5929C11.7027 10.8297 9.82973 12.7027 9.59294 15.0706L9.5 16H8.5L8.40706 15.0706C8.17027 12.7027 6.29734 10.8297 3.92939 10.5929L3 10.5V9.5L3.92939 9.40706C6.29734 9.17027 8.17027 7.29734 8.40706 4.92939Z" fill="currentColor"/>
          </svg>
          <span>Deep Research</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{clientSideEnabled ? "Deep Researchモード中 - クリックで通常モードに戻す" : "Deep Researchモードに切り替え"}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
});

PureXSearchButton.displayName = 'PureXSearchButton';

const XSearchButton = memo(PureXSearchButton);
XSearchButton.displayName = 'XSearchButton';

const PureAttachmentsButton = memo(function PureAttachmentsButton({
  fileInputRef,
  isLoading,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
}) {
  return (
    <Button
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isLoading}
      variant="ghost"
    >
      ファイルを添付
    </Button>
  );
});

PureAttachmentsButton.displayName = 'PureAttachmentsButton';

const AttachmentsButton = memo(PureAttachmentsButton);

const PureStopButton = memo(function PureStopButton({
  stop,
}: {
  stop: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={() => {
        stop();
      }}
      className="size-8 rounded-full bg-black p-0 text-white hover:bg-gray-800"
      aria-label="送信を停止"
    >
      <StopIcon size={16} />
    </Button>
  );
});

PureStopButton.displayName = 'PureStopButton';

const StopButton = memo(PureStopButton);

const SendButton = memo(function SendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
      className="size-8 rounded-full bg-black p-0 text-white hover:bg-gray-800"
      aria-label="送信"
    >
      <ArrowUpIcon size={16} />
    </Button>
  );
});

SendButton.displayName = 'SendButton';
