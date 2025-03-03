import type { ChatRequestOptions, Message } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from './use-scroll-to-bottom';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';

interface MessagesProps {
  chatId: string;
  isLoading: boolean;
  votes?: Array<Vote> | undefined;
  messages: Array<Message>;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  reload?: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function PureMessages({
  chatId,
  isLoading,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  isArtifactVisible,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();
  
  // 最後のメッセージの内容を追跡するためのRef
  const lastMessageContentRef = useRef<string>('');
  // 前回の更新時刻を追跡するためのRef
  const lastUpdateTimeRef = useRef<number>(Date.now());
  // アニメーションフレームIDを保持するRef
  const rafIdRef = useRef<number | null>(null);
  // 前回のisLoading状態を保持するRef
  const prevIsLoadingRef = useRef<boolean>(false);
  // 最後のメッセージを保持するRef
  const lastMessageRef = useRef<Message | null>(null);

  // メッセージ更新を最適化する関数
  const optimizedMessageUpdate = useCallback(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;
    
    // 最後のメッセージを保存
    lastMessageRef.current = lastMessage;
    
    const currentContent = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : JSON.stringify(lastMessage.content);
    
    // 内容が変わっていない場合は更新しない
    if (currentContent === lastMessageContentRef.current) return;
    
    // 内容が変わっている場合は状態を更新
    lastMessageContentRef.current = currentContent;
    
    // 現在時刻を取得
    const now = Date.now();
    
    // 前回の更新から一定時間（16ms = 約60fps）経過していれば即時更新
    if (now - lastUpdateTimeRef.current >= 16) {
      console.log('[PureMessages] メッセージ内容が変更されたため更新します');
      setMessages([...messages]);
      lastUpdateTimeRef.current = now;
    } else {
      // そうでなければ、次のアニメーションフレームで更新
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      
      rafIdRef.current = requestAnimationFrame(() => {
        console.log('[PureMessages] アニメーションフレームでメッセージを更新');
        setMessages([...messages]);
        lastUpdateTimeRef.current = Date.now();
        rafIdRef.current = null;
      });
    }
  }, [messages, setMessages]);

  // ストリーミング中のメッセージ更新を処理
  useEffect(() => {
    // チャットIDが変わった場合はログを出力
    console.log(`[PureMessages] chatId changed: ${chatId}`);
    console.log(`[PureMessages] messages count: ${messages.length}`);
    
    // ストリーミング中は最適化された更新処理を実行
    if (isLoading && messages.length > 0) {
      console.log('[PureMessages] ストリーミング中の定期的な再レンダリングを開始');
      optimizedMessageUpdate();
    }
    
    // ストリーミングが終了した直後（isLoading が true から false に変わった場合）
    if (prevIsLoadingRef.current && !isLoading && lastMessageRef.current) {
      console.log('[PureMessages] ストリーミングが終了しました。最終メッセージを確保します');
      
      // 最後のメッセージが保持されていることを確認
      const currentLastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      
      // 最後のメッセージが失われた場合は復元
      if (!currentLastMessage || 
          (currentLastMessage.role === 'assistant' && 
           lastMessageRef.current.content !== currentLastMessage.content)) {
        console.log('[PureMessages] 最終メッセージを復元します');
        
        // 最後のメッセージを含むメッセージ配列を作成
        const updatedMessages = [...messages.filter(m => m.id !== lastMessageRef.current?.id), lastMessageRef.current];
        setMessages(updatedMessages);
      }
    }
    
    // 現在のisLoading状態を保存
    prevIsLoadingRef.current = isLoading;
    
    // クリーンアップ関数
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [chatId, messages, optimizedMessageUpdate, isLoading, setMessages]);

  // メッセージを「user → assistant → user → assistant」という交互のパターンで表示する
  const sortedMessages = useMemo(() => {
    // メッセージをグループ化して整理する
    const userMessages: Message[] = [];
    const assistantMessages: Message[] = [];
    const otherMessages: Message[] = [];
    
    // まずメッセージを役割ごとに分類
    messages.forEach(message => {
      if (message.role === 'user') {
        userMessages.push(message);
      } else if (message.role === 'assistant') {
        assistantMessages.push(message);
      } else {
        otherMessages.push(message);
      }
    });
    
    // 各グループ内でcreatedAtで昇順ソート
    const sortByCreatedAt = (a: Message, b: Message) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    };
    
    userMessages.sort(sortByCreatedAt);
    assistantMessages.sort(sortByCreatedAt);
    otherMessages.sort(sortByCreatedAt);
    
    // user → assistant の交互パターンで結果を構築
    const result: Message[] = [];
    const maxPairs = Math.max(userMessages.length, assistantMessages.length);
    
    for (let i = 0; i < maxPairs; i++) {
      // ユーザーメッセージを追加（存在する場合）
      if (i < userMessages.length) {
        result.push(userMessages[i]);
      }
      
      // AIの応答を追加（存在する場合）
      if (i < assistantMessages.length) {
        result.push(assistantMessages[i]);
      }
    }
    
    // その他のメッセージ（tool等）を最後に追加
    return [...result, ...otherMessages];
  }, [messages]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
    >
      {sortedMessages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={isLoading && sortedMessages.length - 1 === index}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
        />
      ))}

      {isLoading &&
        sortedMessages.length > 0 &&
        sortedMessages[sortedMessages.length - 1].role === 'user' && <ThinkingMessage />}

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  // chatIdが変更された場合は必ず再レンダリングする
  if (prevProps.chatId !== nextProps.chatId) {
    console.log(`[Messages] chatId changed: ${prevProps.chatId} -> ${nextProps.chatId}`);
    return false; // 必ず再レンダリング
  }
  
  // メッセージが変更された場合も必ず再レンダリング
  if (prevProps.messages.length !== nextProps.messages.length) {
    console.log(`[Messages] messages length changed: ${prevProps.messages.length} -> ${nextProps.messages.length}`);
    return false;
  }
  
  // ストリーミング中は常に再レンダリングする
  if (prevProps.isLoading || nextProps.isLoading) {
    // ただし、メッセージの内容が変わっていない場合は再レンダリングしない
    if (prevProps.isLoading && nextProps.isLoading && 
        prevProps.messages.length === nextProps.messages.length) {
      const prevLastMessage = prevProps.messages[prevProps.messages.length - 1];
      const nextLastMessage = nextProps.messages[nextProps.messages.length - 1];
      
      if (prevLastMessage && nextLastMessage && 
          prevLastMessage.content === nextLastMessage.content) {
        return true; // 内容が同じなら再レンダリングしない
      }
    }
    
    return false; // それ以外の場合は再レンダリング
  }
  
  // メッセージの内容が変更された場合も再レンダリング
  if (!equal(prevProps.messages, nextProps.messages)) {
    console.log(`[Messages] messages content changed`);
    return false;
  }
  
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  
  if (prevProps.isArtifactVisible !== nextProps.isArtifactVisible) return false;

  return true;
});
