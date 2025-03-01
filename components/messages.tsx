import { ChatRequestOptions, Message } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from './use-scroll-to-bottom';
import { Overview } from './overview';
import { memo, useEffect } from 'react';
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
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  useEffect(() => {
    console.log(`[PureMessages] chatId changed: ${chatId}`);
    console.log(`[PureMessages] messages count: ${messages.length}`);
  }, [chatId, messages.length]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
    >
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={isLoading && messages.length - 1 === index}
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
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

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
