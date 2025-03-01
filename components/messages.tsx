import { ChatRequestOptions, Message } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from './use-scroll-to-bottom';
import { Overview } from './overview';
import { memo, useEffect, useMemo } from 'react';
import { Vote } from '@/lib/db/schema';
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

  useEffect(() => {
    console.log(`[PureMessages] chatId changed: ${chatId}`);
    console.log(`[PureMessages] messages count: ${messages.length}`);
    
    // Ensure we scroll to bottom when messages change
    const scrollContainer = messagesContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
    
    // ストリーミング中は定期的に再レンダリングを強制
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isLoading && messages.length > 0) {
      // 最後のメッセージがアシスタントのメッセージの場合
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        console.log('[PureMessages] ストリーミング中の定期的な再レンダリングを開始');
        
        // 100msごとに再レンダリングを強制
        intervalId = setInterval(() => {
          setMessages([...messages]);
        }, 100);
      }
    }
    
    // クリーンアップ関数
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [chatId, messages, messages.length, messagesContainerRef, isLoading, setMessages]);

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
  
  // メッセージの内容が変更された場合も再レンダリング
  if (!equal(prevProps.messages, nextProps.messages)) {
    console.log(`[Messages] messages content changed`);
    return false;
  }
  
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  
  if (prevProps.isLoading && nextProps.isLoading) return false;
  
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  
  if (prevProps.isArtifactVisible !== nextProps.isArtifactVisible) return false;

  return true;
});
