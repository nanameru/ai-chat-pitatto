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
import { ModelSelector } from './model-selector';

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
  onError?: (error: Error) => void;
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
  
  // 親コンポーネントから渡された値を優先
  const isXSearchEnabled = propIsXSearchEnabled !== undefined ? propIsXSearchEnabled : localIsXSearchEnabled;

  const [isWebSearchEnabled, setIsWebSearchEnabled] = useLocalStorage('isWebSearchEnabled', false);

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
    }, 0);
  }, [isXSearchEnabled, setLocalIsXSearchEnabled, onXSearchToggle]);

  const handleWebSearchToggle = useCallback(() => {
    const oldState = isWebSearchEnabled;
    const newState = !oldState;
    
    console.log(`----- Web検索モード切替 -----`);
    console.log(`Web検索ボタンがクリックされました`);
    console.log(`モード変更: ${oldState ? 'Web検索モード' : '通常チャットモード'} → ${newState ? 'Web検索モード' : '通常チャットモード'}`);
    
    setIsWebSearchEnabled(newState);
    
    console.log(`----- Web検索モード切替完了 -----`);
  }, [isWebSearchEnabled, setIsWebSearchEnabled]);

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

  const handleWebSearch = useCallback(async (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions
  ) => {
    console.log('[Web Search] Web検索処理を実行');
    
    try {
      const options: ChatRequestOptions = {
        ...chatRequestOptions,
        data: {
          ...((chatRequestOptions?.data as Record<string, unknown>) || {}),
          searchType: 'web',
          query: input,
          isWebSearchEnabled: true
        }
      };
      
      return await append({ id: nanoid(), content: input, role: 'user', createdAt: new Date() }, options);
    } catch (error) {
      console.error('[Web Search] Web検索処理でエラーが発生:', error);
      throw error;
    }
  }, [append, input]);

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
      const currentMode = effectiveXSearchEnabled ? 'Deep Researchモード' : isWebSearchEnabled ? 'Web検索モード' : 'チャットモード';
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
    [propIsXSearchEnabled, isXSearchEnabled, isWebSearchEnabled, input, isLoading, chatId, selectedModelId, append, onError, setInput, setLocalStorageInput]
  );

  const submitForm = useCallback(async () => {
    // 親コンポーネントから渡された値を優先的に使用
    const effectiveXSearchEnabled = propIsXSearchEnabled !== undefined ? propIsXSearchEnabled : isXSearchEnabled;
    console.log('[Submit] フォーム送信を開始:', {
      mode: effectiveXSearchEnabled ? 'Deep Research' : isWebSearchEnabled ? 'Web検索' : '通常チャット',
      input,
      attachments
    });

    try {
      const currentInput = input;
      const currentAttachments = [...attachments];

      // 送信時に即座に入力フィールドとファイル添付をクリア
      setInput('');
      setLocalStorageInput('');
      setAttachments([]);

      if (currentInput.trim() || currentAttachments.length > 0) {
        // Web検索モードが有効な場合はWeb検索を実行
        if (isWebSearchEnabled && !effectiveXSearchEnabled) {
          const options: ChatRequestOptions = {
            data: {
              searchType: 'web',
              query: currentInput,
              isWebSearchEnabled: true,
              chatId,
              model: selectedModelId
            }
          };
          await handleWebSearch(undefined, options);
          return;
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
    handleWebSearch,
    setAttachments,
    setInput,
    setLocalStorageInput,
    selectedModelId
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
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
      }
    },
    [setAttachments],
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
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
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

      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Pitatto AIにメッセージを送信する"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          className={cx(
            'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-3xl !text-base bg-white py-4 pb-14 px-5 border border-gray-200 focus:border-gray-200 focus-visible:ring-0 focus:outline-none shadow-[0_2px_12px_0_rgba(0,0,0,0.08)] dark:bg-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-700 dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.2)]',
            className,
          )}
          rows={2}
          autoFocus
        />

        <div className="absolute bottom-0 p-4 w-fit flex flex-row justify-start items-center gap-2">
          <Button
            type="button"
            className="h-8 w-8 rounded-full text-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 flex items-center justify-center"
            onClick={(event) => {
              event.preventDefault();
              fileInputRef.current?.click();
            }}
            disabled={isLoading}
            aria-label="ファイルを添付"
          >
            <PaperclipIcon size={16} />
          </Button>
          <WebSearchButton onClick={handleWebSearchToggle} isLoading={isLoading} />
          <XSearchButton
            initialValue={isXSearchEnabled}
            onXSearchToggle={onXSearchToggle || ((enabled, silentMode) => {
              console.log('[MultimodalInput] onXSearchToggle が未定義のため、デフォルト処理を実行します');
            })}
          />
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

const PureWebSearchButton = memo(function PureWebSearchButton({ onClick, isLoading }: { onClick: () => void; isLoading: boolean }) {
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useLocalStorage('isWebSearchEnabled', false);
  
  // クライアント側の状態を管理（サーバーレンダリング用にデフォルト値はfalse）
  const [clientSideEnabled, setClientSideEnabled] = useState(false);
  
  // マウント後、localStorageの値に合わせて状態を更新
  useEffect(() => {
    setClientSideEnabled(isWebSearchEnabled);
  }, [isWebSearchEnabled]);
  
  const handleButtonClick = useCallback(() => {
    // 現在の状態を取得
    const currentState = clientSideEnabled;
    const newState = !currentState;
    
    console.log(`[PureWebSearchButton] ボタンがクリックされました: ${currentState ? 'Web検索モード' : '通常チャットモード'} → ${newState ? 'Web検索モード' : '通常チャットモード'}`);
    
    // 即座に状態を更新して視覚的なフィードバックを提供
    setClientSideEnabled(newState);
    setIsWebSearchEnabled(newState);
    
    // カスタムイベントを即座に発火
    try {
      const event = new CustomEvent('websearch-mode-changed', { 
        detail: { 
          enabled: newState,
          previous: currentState,
          timestamp: new Date().toISOString(),
          source: 'button-click'
        } 
      });
      window.dispatchEvent(event);
    } catch (error) {
      // エラーログは表示しない
    }
    
    // 親コンポーネントのハンドラを呼び出し
    onClick();
    
    // 状態が確実に更新されたことを確認
    console.log(`[PureWebSearchButton] モード切替完了: ${newState ? 'Web検索モード' : '通常チャットモード'}`);
  }, [clientSideEnabled, onClick, setIsWebSearchEnabled]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={handleButtonClick}
            disabled={isLoading}
            className={cx(
              "h-8 px-4 rounded-full text-sm border flex items-center gap-2 transition-colors duration-200",
              clientSideEnabled
                ? "bg-blue-100 text-blue-500 hover:bg-blue-200 border-blue-200"
                : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
            )}
            aria-label="Webで検索"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.6001 9H20.4001" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.6001 15H20.4001" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 3C14.5 7.5 14.5 16.5 12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 3C9.5 7.5 9.5 16.5 12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Webで検索</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{clientSideEnabled ? "Web検索モード中 - クリックで通常モードに戻す" : "Web検索モードに切り替え"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

PureWebSearchButton.displayName = 'PureWebSearchButton';

const WebSearchButton = memo(PureWebSearchButton);
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
  useEffect(() => {
    setClientSideEnabled(initialValue);
  }, [initialValue]);
  
  // ボタンの状態を視覚的に表示するためのクラス
  const buttonClass = cx(
    "h-8 px-4 rounded-full text-sm border flex items-center gap-2 transition-colors duration-200",
    clientSideEnabled 
      ? "bg-blue-100 text-blue-500 hover:bg-blue-200 border-blue-200"
      : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
  );
  
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
            className={buttonClass}
            aria-label="Deep Research"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 self-center" style={{ transform: 'translateY(-1px)' }}>
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
      className="h-8 w-8 rounded-full bg-black p-0 text-white hover:bg-gray-800"
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
      className="h-8 w-8 rounded-full bg-black p-0 text-white hover:bg-gray-800"
      aria-label="送信"
    >
      <ArrowUpIcon size={16} />
    </Button>
  );
});

SendButton.displayName = 'SendButton';
