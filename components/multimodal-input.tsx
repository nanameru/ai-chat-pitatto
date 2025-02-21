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
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';
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
import { XSearchState } from '@/lib/ai/x-search';

interface XSearchResponse {
  xSearchState?: XSearchState;
  [key: string]: any;
}

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  selectedModelId,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<XSearchResponse | void>;
  className?: string;
  selectedModelId: string;
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

  const [isXSearchEnabled, setIsXSearchEnabled] = useState(false);
  const [xSearchState, setXSearchState] = useState<XSearchState | undefined>();

  const submitForm = useCallback(async () => {
    const resetHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = '98px';
      }
    };

    try {
      window.history.replaceState({}, '', `/chat/${chatId}`);

      // 現在の入力とアタッチメントを保持
      const currentInput = input;
      const currentAttachments = [...attachments];

      // 入力フィールドをクリア
      setInput('');
      setLocalStorageInput('');
      resetHeight();

      // メッセージを送信
      if (currentInput.trim() || currentAttachments.length > 0) {
        const message = {
          content: currentInput.trim(),
          role: 'user'
        };

        const response = await handleSubmit(undefined, {
          body: {
            message,
            attachments: currentAttachments,
            options: {
              stream: true,
              temperature: 0.7,
              isXSearch: isXSearchEnabled,
              xSearchState,
            }
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          }
        });

        // レスポンスからX検索の状態を更新
        if (response?.xSearchState) {
          setXSearchState(response.xSearchState);
        } else {
          // 検索が完了したらリセット
          setXSearchState(undefined);
          // X検索の有効状態は維持する
        }
      }

      // 送信完了後にアタッチメントをクリア
      setAttachments([]);
    } catch (error) {
      console.error('Failed to submit message:', error);
      toast.error('メッセージの送信に失敗しました。もう一度お試しください。');
      // エラー時は状態をリセット
      setXSearchState(undefined);
      setIsXSearchEnabled(false);
    }
  }, [
    input,
    attachments,
    chatId,
    handleSubmit,
    setInput,
    setAttachments,
    setLocalStorageInput,
    isXSearchEnabled,
    xSearchState,
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

  const onError = (error: Error) => {
    console.error('Chat error details:', {
      error,
      message: error.message,
      stack: error.stack,
      type: error.name,
      timestamp: new Date().toISOString(),
      localStorage: {
        size: new Blob([JSON.stringify(localStorage)]).size,
        keys: Object.keys(localStorage),
      }
    });

    // ローカルストレージの使用状況を詳細に表示
    let totalSize = 0;
    const itemSizes: Record<string, { size: number; sizeKB: string }> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        const size = new Blob([value || '']).size;
        totalSize += size;
        itemSizes[key] = {
          size,
          sizeKB: (size / 1024).toFixed(2) + ' KB'
        };
      }
    }
    console.log('LocalStorage usage:', {
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2) + ' KB',
      itemSizes
    });

    try {
      // QUOTA_BYTESエラーの場合、関連するストレージのみをクリア
      if (error.message.includes('QUOTA_BYTES')) {
        try {
          // チャット関連のストレージのみをクリア
          const keysToKeep = ['supabase.auth.token'];
          const keysToRemove = [];
          
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !keysToKeep.includes(key)) {
              keysToRemove.push(key);
            }
          }
          
          console.log('Clearing chat-related localStorage:', {
            keysToRemove,
            beforeSize: totalSize,
            beforeSizeKB: (totalSize / 1024).toFixed(2) + ' KB'
          });

          keysToRemove.forEach(key => localStorage.removeItem(key));

          // クリア後のサイズを再計算
          let afterSize = 0;
          for (let i = 0; i <localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              const value = localStorage.getItem(key);
              afterSize += new Blob([value || '']).size;
            }
          }

          console.log('Cleared localStorage:', {
            removedKeys: keysToRemove,
            afterSize,
            afterSizeKB: (afterSize / 1024).toFixed(2) + ' KB',
            freedSpace: (totalSize - afterSize) / 1024 + ' KB'
          });
        } catch (e) {
          if (e instanceof Error) {
            console.error('Failed to clear localStorage:', {
              error: e,
              message: e.message,
              stack: e.stack
            });
          } else {
            console.error('Failed to clear localStorage:', e);
          }
        }
      }

      let errorMessage = error.message;
      try {
        const errorData = JSON.parse(error.message);
        console.log('Parsed error data:', errorData);
        errorMessage = errorData.details || errorData.message || errorData.error || error.message;
      } catch (e) {
        console.log('Error message is not JSON:', {
          message: error.message,
          parseError: e instanceof Error ? e.message : String(e)
        });
      }

      toast.error(errorMessage);
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.log('Error in error handling:', e.message);
      } else {
        console.log('Unknown error occurred');
      }
    }
  };

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

  const handleXSearch = useCallback(() => {
    setIsXSearchEnabled(prev => !prev);
    setXSearchState(prev => prev ? undefined : {
      stage: 'subquery_generation'
    });
  }, []);

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
            className="size-8 inline-flex items-center justify-center"
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
          <XSearchButton onClick={handleXSearch} isLoading={isLoading} isEnabled={isXSearchEnabled} />
        </div>

        <div className="absolute bottom-0 right-0 p-4 w-fit flex flex-row justify-end items-center gap-2">
          <ModelSelector selectedModelId={selectedModelId} className="h-8" />
          {isLoading ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <SendButton
              input={input}
              submitForm={submitForm}
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
              "size-8 px-3 rounded-full text-sm border border-gray-200",
              isWebSearchEnabled
                ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                : "bg-white text-gray-700 hover:bg-gray-100"
            )}
            aria-label="Webで検索"
          >
            <span className="whitespace-nowrap">Webで検索</span>
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
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={onClick}
            disabled={isLoading}
            className={cx(
              "size-8 px-3 rounded-full text-sm border",
              isEnabled
                ? "bg-blue-100 text-blue-600 hover:bg-blue-200 border-blue-200"
                : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
            )}
            aria-label="Xから検索"
          >
            Xから検索
          </Button>
        </TooltipTrigger>
        <TooltipContent>X（旧Twitter）で検索</TooltipContent>
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

const PureStopButton = React.memo(function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
}) {
  return (
    <Button
      type="button"
      onClick={() => {
        stop();
        setMessages((messages) => {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === 'assistant') {
            return messages.slice(0, -1);
          }
          return messages;
        });
      }}
      className="size-8 w-8 rounded-full bg-black p-0 text-white hover:bg-gray-800"
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
      className="size-8 w-8 rounded-full bg-black p-0 text-white hover:bg-gray-800"
      aria-label="送信"
    >
      <ArrowUpIcon size={16} />
    </Button>
  );
});

SendButton.displayName = 'SendButton';
