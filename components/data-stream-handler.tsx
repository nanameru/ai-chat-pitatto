'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef, useState } from 'react';
import { artifactDefinitions, type ArtifactKind } from './artifact';
import type { Suggestion } from '@/lib/db/schema';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind';
  content: string | Suggestion;
};

export function DataStreamHandler({ id }: { id: string }) {
  const { data: dataStream } = useChat({ id });
  const { artifact, setArtifact, setMetadata } = useArtifact();
  const lastProcessedIndex = useRef(-1);
  const prevIdRef = useRef(id);
  
  // チャットの詳細情報を取得
  const { data: chatData } = useSWR(`/api/chat?id=${id}`, fetcher);
  
  // チャットに関連するメッセージを取得
  const { data: messagesData, error: messagesError } = useSWR(`/api/messages?chatId=${id}`, fetcher, {
    onError: (error) => {
      console.error('[DataStreamHandler] メッセージ取得エラー:', error);
    }
  });

  // チャットIDが変更された場合の処理
  useEffect(() => {
    if (id !== prevIdRef.current) {
      console.log(`[DataStreamHandler] チャットIDが変更されました: ${prevIdRef.current} -> ${id}`);
      prevIdRef.current = id;
      
      // 新しいチャットに関連するArtifactを初期化
      if (messagesData?.length > 0) {
        // メッセージからArtifactを含むものを探す - 条件を緩和
        const artifactMessages = messagesData.filter((msg: { content?: string; role?: string }) => {
          if (!msg.content || typeof msg.content !== 'string') return false;
          
          // より広い条件でArtifactを検出
          return msg.content.includes('artifact') || 
                 msg.content.includes('documentId') || 
                 msg.content.includes('kind') ||
                 (msg.role === 'assistant' && msg.content.includes('```'));
        });
        
        if (artifactMessages.length > 0) {
          console.log('[DataStreamHandler] このチャットにはArtifactが含まれています:', artifactMessages);
          
          // Artifactの状態を復元（最後のArtifactメッセージを使用）
          try {
            // 最新のArtifactメッセージを取得
            const lastArtifactMessage = artifactMessages[artifactMessages.length - 1];
            
            // Artifactの状態を設定 - 強制的に表示状態にする
            setTimeout(() => {
              // 少し遅延させて実行し、レンダリングタイミングを確保
              setArtifact(currentArtifact => {
                console.log('[DataStreamHandler] Artifactの状態を強制的に表示状態に設定します:', {
                  before: currentArtifact,
                  chatId: id
                });
                
                return {
                  ...currentArtifact,
                  isVisible: true, // 明示的に表示状態にする
                  status: 'idle'
                };
              });
            }, 500); // 500msの遅延を追加
            
            console.log('[DataStreamHandler] Artifactの状態を復元しました');
          } catch (error) {
            console.error('[DataStreamHandler] Artifactの状態復元中にエラーが発生しました:', error);
          }
        } else {
          console.log('[DataStreamHandler] このチャットにはArtifactが含まれていません');
          // Artifactをリセット
          setArtifact(initialArtifactData);
          
          // 必要に応じて、チャットにメッセージがある場合でも強制的にチェックする
          if (messagesData.length > 0) {
            // チャットにメッセージがある場合、後で再度チェック
            setTimeout(() => {
              console.log('[DataStreamHandler] 再度チェック: チャットID', id);
              // データが存在する場合は強制的に表示状態にする
              setArtifact(current => {
                if (current.documentId && current.documentId !== 'init') {
                  console.log('[DataStreamHandler] 再度チェック: Artifactが存在するため表示状態に設定します');
                  return {
                    ...current,
                    isVisible: true,
                    status: 'idle'
                  };
                }
                return current;
              });
            }, 1000); // 1秒後にチェック
          }
        }
      } else if (messagesError || !messagesData) {
        console.log('[DataStreamHandler] メッセージデータの取得に失敗しました。ドキュメントAPIを直接確認します');
        
        // メッセージが取得できない場合は、ドキュメントAPIを直接確認
        fetch(`/api/document?id=${id}`)
          .then(response => response.json())
          .then(documents => {
            console.log('[DataStreamHandler] ドキュメントAPI応答:', documents);
            
            if (documents && documents.length > 0) {
              // ドキュメントが存在する場合は、Artifactを表示状態に設定
              console.log('[DataStreamHandler] ドキュメントが見つかりました。Artifactを表示状態に設定します:', documents[0]);
              
              setTimeout(() => {
                setArtifact(currentArtifact => ({
                  ...currentArtifact,
                  documentId: documents[0].id,
                  isVisible: true,
                  status: 'idle',
                  kind: documents[0].kind || 'code'
                }));
              }, 500);
            }
          })
          .catch(error => {
            console.error('[DataStreamHandler] ドキュメント取得エラー:', error);
          });
      } else {
        console.log('[DataStreamHandler] メッセージデータがまだロードされていないか、空です');
      }
      
      // 処理済みインデックスをリセット
      lastProcessedIndex.current = -1;
    }
  }, [id, messagesData, messagesError, setArtifact]);
  
  // 全てのデータが読み込まれた後に、Artifactの状態を再度チェック
  useEffect(() => {
    if (chatData && (messagesData || messagesError)) {
      // データが読み込まれた後に、Artifactの状態を再度チェック
      setTimeout(() => {
        setArtifact(current => {
          // documentIdが存在する場合は表示状態にする
          if (current.documentId && current.documentId !== 'init') {
            console.log('[DataStreamHandler] データ読み込み後のチェック: Artifactが存在するため表示状態に設定します', {
              documentId: current.documentId,
              isVisible: current.isVisible,
              chatId: id
            });
            return {
              ...current,
              isVisible: true,
              status: 'idle'
            };
          }
          return current;
        });
      }, 1500); // 1.5秒後にチェック
    }
  }, [chatData, messagesData, id, setArtifact]);

  // データストリームの処理
  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    console.log('[DataStreamHandler] Processing new deltas:', newDeltas);
    console.log('[DataStreamHandler] Current artifact state:', artifact);

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          console.log('[DataStreamHandler] Creating new artifact with streaming status');
          return { ...initialArtifactData, status: 'streaming' };
        }
        
        console.log('[DataStreamHandler] Processing delta type:', delta.type);

        switch (delta.type) {
          case 'id':
            const updatedArtifactWithId = {
              ...draftArtifact,
              documentId: delta.content as string,
              isVisible: true, // idが設定された時点で表示する
              status: 'streaming' as const,
            };
            console.log('[DataStreamHandler] Document ID updated:', {
              documentId: delta.content,
              artifact: updatedArtifactWithId
            });
            return updatedArtifactWithId;

          case 'title':
            const updatedArtifactWithTitle = {
              ...draftArtifact,
              title: delta.content as string,
              isVisible: true,
              status: 'streaming' as const,
            };
            console.log('[DataStreamHandler] Title updated:', {
              title: delta.content,
              artifact: updatedArtifactWithTitle
            });
            return updatedArtifactWithTitle;

          case 'kind':
            const updatedArtifact = {
              ...draftArtifact,
              kind: delta.content as ArtifactKind,
              isVisible: true, // Artifactを自動的に表示するように設定
              status: 'streaming' as const,
            };
            console.log('[DataStreamHandler] After kind update, artifact state:', updatedArtifact);
            return updatedArtifact;

          case 'clear':
            const clearedArtifact = {
              ...draftArtifact,
              content: '',
              status: 'streaming' as const,
            };
            console.log('[DataStreamHandler] Content cleared');
            return clearedArtifact;

          case 'finish':
            const finishedArtifact = {
              ...draftArtifact,
              status: 'idle' as const,
              isVisible: true, // 完了時にも表示されるようにする
            };
            console.log('[DataStreamHandler] Streaming finished, artifact:', finishedArtifact);
            return finishedArtifact;

          case 'text-delta':
          case 'code-delta':
          case 'sheet-delta':
          case 'image-delta':
            const updatedContent = {
              ...draftArtifact,
              content: (draftArtifact.content || '') + (delta.content as string),
              isVisible: true,
              status: 'streaming' as const,
            };
            console.log('[DataStreamHandler] Content update:', {
              type: delta.type,
              contentBefore: draftArtifact.content,
              contentAfter: updatedContent.content,
              delta: delta.content
            });
            return updatedContent;
            
          default:
            console.log('[DataStreamHandler] Unhandled delta type:', delta.type);
            return draftArtifact;
        }
      });
    });
  }, [dataStream, setArtifact, setMetadata, artifact]);

  return null;
}
