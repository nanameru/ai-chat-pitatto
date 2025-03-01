'use client';

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  memo,
  type ReactNode,
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

import { sanitizeUIMessages } from '@/lib/utils';
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
  onXSearchToggle?: (newValue: boolean) => void;
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

  const handleXSearchToggle = useCallback(() => {
    const oldState = isXSearchEnabled;
    const newState = !oldState;
    
    // モード変更のログ出力を詳細に
    console.log(`----- X検索モード切替 -----`);
    console.log(`X検索ボタンがクリックされました`);
    console.log(`モード変更: ${oldState ? 'X検索モード' : '通常チャットモード'} → ${newState ? 'X検索モード' : '通常チャットモード'}`);
    console.log(`ボタンがクリックされました。現在の状態: ${newState}`);
    
    // ローカルの状態を即座に更新
    setLocalIsXSearchEnabled(newState);
    
    // LocalStorageに保存（他のコンポーネントも確実に値を取得できるようにする）
    try {
      window.localStorage.setItem('searchMode', JSON.stringify(newState));
      console.log(`[X検索] LocalStorageに値を保存しました: ${newState}`);
    } catch (error) {
      console.error(`[X検索] LocalStorageへの保存に失敗しました:`, error);
    }
    
    // まず親コンポーネントのコールバックを呼び出す（最優先）
    if (onXSearchToggle) {
      console.log(`[X検索] 親コンポーネントにモード変更を通知: ${oldState ? 'X検索モード' : '通常チャットモード'} → ${newState ? 'X検索モード' : '通常チャットモード'}`);
      onXSearchToggle(newState);
    }
    
    // カスタムイベントを発火して他のコンポーネントに即座に通知
    try {
      const event = new CustomEvent('xsearch-mode-changed', { 
        detail: { 
          enabled: newState,
          previous: oldState,
          timestamp: Date.now() 
        } 
      });
      window.dispatchEvent(event);
      console.log(`[X検索] カスタムイベントを発火しました`);
    } catch (error) {
      console.error(`[X検索] カスタムイベント発火に失敗しました:`, error);
    }
    
    console.log(`----- X検索モード切替完了 -----`);
  }, [isXSearchEnabled, setLocalIsXSearchEnabled, onXSearchToggle]);

  const handleXSearchSubmit = async (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions
  ) => {
    console.log('[XSearch] X検索処理を実行');
    
    try {
      const options: ChatRequestOptions = {
        ...chatRequestOptions,
        xSearchEnabled: true
      };
      
      return await append({ id: nanoid(), content: input, role: 'user', createdAt: new Date() }, options);
    } catch (error) {
      console.error('[XSearch] X検索処理でエラーが発生:', error);
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
      const currentMode = effectiveXSearchEnabled ? 'X検索モード' : 'チャットモード';
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
    [propIsXSearchEnabled, isXSearchEnabled, input, isLoading, chatId, selectedModelId, append, onError, setInput, setLocalStorageInput]
  );

  const submitForm = useCallback(async () => {
    // 親コンポーネントから渡された値を優先的に使用
    const effectiveXSearchEnabled = propIsXSearchEnabled !== undefined ? propIsXSearchEnabled : isXSearchEnabled;
    console.log('[Submit] フォーム送信を開始:', {
      mode: effectiveXSearchEnabled ? 'X検索' : '通常チャット',
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
    propIsXSearchEnabled,
    handleSubmitWithLogging,
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

  const [isWebSearchEnabled] = useLocalStorage('isWebSearchEnabled', false);

  const handleWebSearch = useCallback(() => {
    const searchQuery = input;
    const message: CreateMessage = {
      id: nanoid(),
      content: input,
      role: 'user',
      createdAt: new Date(),
    };

    append(message, {
      data: {
        searchType: 'web',
        query: searchQuery,
        isWebSearchEnabled,
      }
    });
  }, [input, append, isWebSearchEnabled]);

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
          <WebSearchButton onClick={handleWebSearch} isLoading={isLoading} />
          <XSearchButton onClick={handleXSearchToggle} isLoading={isLoading} isEnabled={isXSearchEnabled} />
        </div>

        <div className="absolute bottom-0 right-0 p-4 w-fit flex flex-row justify-end items-center gap-2">
          <ModelSelector selectedModelId={selectedModelId} className="h-8" />
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
  const [isWebSearchEnabled] = useLocalStorage('isWebSearchEnabled', false);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={onClick}
            disabled={isLoading}
            className={cx(
              "h-8 px-4 rounded-full text-sm border border-gray-200 flex items-center gap-2",
              isWebSearchEnabled
                ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                : "bg-white text-gray-700 hover:bg-gray-100"
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
        <TooltipContent>インターネットで検索</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

PureWebSearchButton.displayName = 'PureWebSearchButton';

const WebSearchButton = memo(PureWebSearchButton);
WebSearchButton.displayName = 'WebSearchButton';

const PureXSearchButton = memo(function PureXSearchButton({ onClick, isLoading, isEnabled }: { onClick: () => void; isLoading: boolean; isEnabled: boolean }) {
  // Use useState to manage the button state with a default value of false for server rendering
  const [clientSideEnabled, setClientSideEnabled] = useState(false);
  
  // After hydration, update the client-side state to match the prop
  useEffect(() => {
    setClientSideEnabled(isEnabled);
  }, [isEnabled]);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onClick();
            }}
            disabled={isLoading}
            className={cx(
              "h-8 px-4 rounded-full text-sm border flex items-center gap-2 transition-colors duration-300",
              clientSideEnabled
                ? "bg-blue-500 text-white hover:bg-blue-600 border-blue-400 shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
            )}
            aria-label="Xから検索"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{clientSideEnabled ? "X検索モード中" : "Xから検索"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{clientSideEnabled ? "通常チャットモードに戻す" : "X（旧Twitter）で検索"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

PureXSearchButton.displayName = 'PureXSearchButton';

const XSearchButton = memo(PureXSearchButton);

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
