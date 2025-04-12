import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';

interface XSearchResponse {
  xSearchState?: {
    [key: string]: any;
  };
  [key: string]: any;
}

import { formatDistance } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ArtifactActions } from './artifact-actions';
import { ArtifactCloseButton } from './artifact-close-button';
import { ArtifactMessages } from './artifact-messages';
import { useSidebar } from './ui/sidebar';
import { useArtifact } from '@/hooks/use-artifact';
import { imageArtifact } from '@/artifacts/image/client';
import { codeArtifact } from '@/artifacts/code/client';
import { sheetArtifact } from '@/artifacts/sheet/client';
import { textArtifact } from '@/artifacts/text/client';
import { customArtifact } from '@/artifacts/custom/client';
import equal from 'fast-deep-equal';

export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
  customArtifact,
];
export type ArtifactKind = (typeof artifactDefinitions)[number]['kind'];

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: 'streaming' | 'idle';
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

function PureArtifact({
  chatId,
  input,
  setInput,
  handleSubmit,
  isLoading,
  stop,
  attachments,
  setAttachments,
  append,
  messages,
  setMessages,
  reload,
  votes,
  isReadonly,
  selectedModelId,
}: {
  chatId: string;
  input: string;
  setInput: (input: string) => void;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<undefined | XSearchResponse>;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  votes: Array<Vote> | undefined;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
  selectedModelId: string;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();
  
  // チャットIDが変更された時に明示的にArtifactの状態を初期化
  useEffect(() => {
    console.log(`[Artifact] チャットIDが読み込まれました: ${chatId}`);
    
    // チャットIDが有効な場合のみ処理
    if (chatId && chatId !== 'new') {
      // データが読み込まれるまで少し待つ
      setTimeout(() => {
        console.log(`[Artifact] チャットID ${chatId} のArtifact状態を確認します:`, {
          isVisible: artifact.isVisible,
          documentId: artifact.documentId,
          kind: artifact.kind
        });
        
        // documentIdが存在する場合は表示状態にする
        if (artifact.documentId && artifact.documentId !== 'init' && !artifact.isVisible) {
          console.log(`[Artifact] documentIdが存在しますが表示されていないため、表示状態に設定します`);
          setArtifact(current => ({
            ...current,
            isVisible: true,
            status: 'idle'
          }));
        }
      }, 1000); // 1秒待つ
    }
  }, [chatId, artifact.documentId, artifact.isVisible, setArtifact]);

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    artifact.documentId !== 'init' 
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
    {
      // ドキュメント取得のリトライ設定
      errorRetryCount: 3,
      dedupingInterval: 2000,
      revalidateOnFocus: true,
      onSuccess: (data) => {
        console.log('[Artifact] Document fetched successfully:', data);
        
        // ドキュメントが取得できた場合は表示状態にする
        if (data && data.length > 0) {
          console.log('[Artifact] ドキュメントが取得できたため、表示状態に設定します');
          setArtifact(current => ({
            ...current,
            isVisible: true,
            status: 'idle'
          }));
        }
      },
      onError: (error) => {
        console.error('[Artifact] Error fetching document:', error);
      }
    }
  );

  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);

  const { open: isSidebarOpen } = useSidebar();

  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        console.log('[Artifact] Setting document and content:', mostRecentDocument);
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        
        // コンテンツが空でない場合のみ設定する
        const content = mostRecentDocument.content ?? '';
        if (content.trim() !== '') {
          setArtifact((currentArtifact) => ({
            ...currentArtifact,
            content: content,
            isVisible: true, // コンテンツがある場合は必ず表示する
            status: 'idle' as const,
          }));
        } else {
          console.warn('[Artifact] Document content is empty');
        }
      }
    }
  }, [documents, setArtifact]);

  useEffect(() => {
    mutateDocuments();
  }, [artifact.status, mutateDocuments]);

  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact) return;

      mutate<Array<Document>>(
        `/api/document?id=${artifact.documentId}`,
        async (currentDocuments) => {
          if (!currentDocuments) return undefined;

          const currentDocument = currentDocuments.at(-1);

          if (!currentDocument || !currentDocument.content) {
            setIsContentDirty(false);
            return currentDocuments;
          }

          if (currentDocument.content !== updatedContent) {
            await fetch(`/api/document?id=${artifact.documentId}`, {
              method: 'POST',
              body: JSON.stringify({
                title: artifact.title,
                content: updatedContent,
                kind: artifact.kind,
              }),
            });

            setIsContentDirty(false);

            const newDocument = {
              ...currentDocument,
              content: updatedContent,
              createdAt: new Date(),
            };

            return [...currentDocuments, newDocument];
          }
          return currentDocuments;
        },
        { revalidate: false },
      );
    },
    [artifact, mutate],
  );

  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,
  );

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (document && updatedContent !== document.content) {
        setIsContentDirty(true);

        if (debounce) {
          debouncedHandleContentChange(updatedContent);
        } else {
          handleContentChange(updatedContent);
        }
      }
    },
    [document, debouncedHandleContentChange, handleContentChange],
  );

  function getDocumentContentById(index: number) {
    if (!documents) return '';
    if (!documents[index]) return '';
    return documents[index].content ?? '';
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents) return;

    if (type === 'latest') {
      setCurrentVersionIndex(documents.length - 1);
      setMode('edit');
    }

    if (type === 'toggle') {
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'));
    }

    if (type === 'prev') {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === 'next') {
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1);
      }
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  /*
   * NOTE: if there are no documents, or if
   * the documents are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  useEffect(() => {
    if (artifact.documentId !== 'init') {
      if (artifactDefinition.initialize) {
        artifactDefinition.initialize({
          documentId: artifact.documentId,
          setMetadata,
        });
      }
    }
  }, [artifact.documentId, artifactDefinition, setMetadata]);

  // Artifactの表示状態をログに出力
  useEffect(() => {
    console.log(`[Artifact] 表示状態が変更されました: isVisible=${artifact.isVisible}, chatId=${chatId}`);
    
    // 表示状態が変更された場合、ドキュメントを再取得
    if (artifact.isVisible && artifact.documentId && artifact.documentId !== 'init') {
      // ドキュメントを再取得
      mutateDocuments();
    }
  }, [artifact.isVisible, artifact.documentId, chatId, mutateDocuments]);
  
  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50 bg-transparent"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {!isMobile && (
            <motion.div
              className="fixed bg-background h-dvh"
              initial={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              animate={{ width: windowWidth, right: 0 }}
              exit={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
            />
          )}

          {!isMobile && (
            <motion.div
              className="relative w-[400px] bg-muted dark:bg-background h-dvh shrink-0"
              initial={{ opacity: 0, x: 10, scale: 1 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                transition: {
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 200,
                  damping: 30,
                },
              }}
              exit={{
                opacity: 0,
                x: 0,
                scale: 1,
                transition: { duration: 0 },
              }}
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="left-0 absolute h-dvh w-[400px] top-0 bg-zinc-900/50 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex flex-col h-full justify-between items-center gap-4">
                <ArtifactMessages
                  chatId={chatId}
                  isLoading={isLoading}
                  votes={votes}
                  messages={messages}
                  setMessages={setMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  artifactStatus={artifact.status}
                />

                <form className="flex flex-row gap-2 relative items-end w-full px-4 pb-4">
                  <MultimodalInput
                    chatId={chatId}
                    input={input}
                    setInput={setInput}
                    isLoading={isLoading}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    append={append}
                    className="bg-background dark:bg-muted"
                    selectedModelId={selectedModelId}
                  />
                </form>
              </div>
            </motion.div>
          )}

          <motion.div
            className="fixed dark:bg-muted bg-background h-dvh flex flex-col overflow-y-scroll md:border-l dark:border-zinc-700 border-zinc-200"
            initial={
              isMobile
                ? {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
                : {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
            }
            animate={
              isMobile
                ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth : 'calc(100dvw)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
                : {
                    opacity: 1,
                    x: 400,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth
                      ? windowWidth - 400
                      : 'calc(100dvw-400px)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.5,
              transition: {
                delay: 0.1,
                type: 'spring',
                stiffness: 600,
                damping: 30,
              },
            }}
          >
            <div className="p-2 flex flex-row justify-between items-start">
              <div className="flex flex-row gap-4 items-start">
                <ArtifactCloseButton />

                <div className="flex flex-col">
                  <div className="font-medium">{artifact.title}</div>

                  {isContentDirty ? (
                    <div className="text-sm text-muted-foreground">
                      Saving changes...
                    </div>
                  ) : document ? (
                    <div className="text-sm text-muted-foreground">
                      {`Updated ${formatDistance(
                        new Date(document.createdAt),
                        new Date(),
                        {
                          addSuffix: true,
                        },
                      )}`}
                    </div>
                  ) : (
                    <div className="w-32 h-3 mt-2 bg-muted-foreground/20 rounded-md animate-pulse" />
                  )}
                </div>
              </div>

              <ArtifactActions
                artifact={artifact}
                currentVersionIndex={currentVersionIndex}
                handleVersionChange={handleVersionChange}
                isCurrentVersion={isCurrentVersion}
                mode={mode}
                metadata={metadata}
                setMetadata={setMetadata}
              />
            </div>

            <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center">
              {/* デバッグ情報をコンソールに出力 */}
              <>{(() => {
                console.log('[Artifact] Rendering content:', {
                  artifactDefinition,
                  title: artifact.title,
                  content: isCurrentVersion ? artifact.content : getDocumentContentById(currentVersionIndex),
                  mode,
                  status: artifact.status,
                  documents,
                  document
                });
                return null;
              })()}</>
              {artifactDefinition ? (
                <>
                  <artifactDefinition.content
                    title={artifact.title}
                    content={
                      isCurrentVersion
                        ? artifact.content
                        : getDocumentContentById(currentVersionIndex)
                    }
                    mode={mode}
                    status={artifact.status}
                    currentVersionIndex={currentVersionIndex}
                    suggestions={[]}
                    onSaveContent={saveContent}
                    isInline={false}
                    isCurrentVersion={isCurrentVersion}
                    getDocumentContentById={getDocumentContentById}
                    isLoading={isDocumentsFetching && !artifact.content}
                    metadata={metadata}
                    setMetadata={setMetadata}
                  />
                </>
              ) : (
                <div className="p-4 border border-red-500 m-4">
                  <h3 className="text-red-500">Artifact Definition Not Found</h3>
                  <pre className="bg-gray-100 p-2 mt-2 text-xs overflow-auto">
                    {JSON.stringify(artifact, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* コンテンツが空の場合のフォールバック表示 */}
              {artifactDefinition && (!artifact.content || artifact.content.trim() === '') && (
                <div className="p-4 border border-yellow-500 m-4">
                  <h3 className="text-yellow-500">Content is Empty</h3>
                  <p className="mt-2">コンテンツが空です。データが正しく取得されていない可能性があります。</p>
                  <p className="mt-2">チャットID: {chatId}</p>
                  <pre className="bg-gray-100 p-2 mt-2 text-xs overflow-auto">
                    {JSON.stringify({
                      title: artifact.title,
                      kind: artifact.kind,
                      documentId: artifact.documentId,
                      status: artifact.status,
                      isVisible: artifact.isVisible,
                      chatId: chatId,
                      documentsLoaded: documents ? documents.length : 0
                    }, null, 2)}
                  </pre>
                  <div className="flex flex-col gap-2 mt-2">
                    <button 
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      onClick={() => {
                        console.log('[Artifact] 強制的に表示状態を設定します');
                        setArtifact(current => ({
                          ...current,
                          isVisible: true
                        }));
                      }}
                    >
                      表示状態を強制的に設定
                    </button>
                    
                    <button 
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      onClick={() => {
                        console.log('[Artifact] ドキュメントを再取得します');
                        mutateDocuments();
                      }}
                    >
                      ドキュメントを再取得
                    </button>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {isCurrentVersion && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    append={append}
                    isLoading={isLoading}
                    stop={stop}
                    setMessages={setMessages}
                    artifactKind={artifact.kind}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
                  documents={documents}
                  handleVersionChange={handleVersionChange}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  // チャットIDが変更された場合は必ず再レンダリング
  if (prevProps.chatId !== nextProps.chatId) {
    console.log('[Artifact] チャットIDが変更されたため再レンダリングします');
    return false;
  }
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (!equal(prevProps.messages, nextProps.messages.length)) return false;

  return true;
});
