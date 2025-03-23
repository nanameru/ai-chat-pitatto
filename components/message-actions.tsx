'use client';

import type { Message } from 'ai';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import type { Vote } from '@/lib/db/schema';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { memo } from 'react';
import equal from 'fast-deep-equal';

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) return null;
  if (message.role === 'user') return null;
  if (message.toolInvocations && message.toolInvocations.length > 0)
    return null;

  const handleUpvote = async () => {
    try {
      const response = await fetch('/api/vote', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          messageId: message.id,
          type: 'up',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to upvote response');
      }

      const updatedVotes = await response.json();
      mutate(`/api/vote?chatId=${chatId}`, updatedVotes, false);
      toast.success('Upvoted response!');
    } catch (error) {
      console.error('Failed to upvote:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upvote response');
    }
  };

  const handleDownvote = async () => {
    try {
      const response = await fetch('/api/vote', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          messageId: message.id,
          type: 'down',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to downvote response');
      }

      const updatedVotes = await response.json();
      mutate(`/api/vote?chatId=${chatId}`, updatedVotes, false);
      toast.success('Downvoted response!');
    } catch (error) {
      console.error('Failed to downvote:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to downvote response');
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              onClick={async () => {
                await copyToClipboard(message.content as string);
                toast.success('Copied to clipboard!');
              }}
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>コピー</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={`py-1 px-2 h-fit ${
                vote?.isUpvoted
                  ? 'text-primary'
                  : 'text-muted-foreground'
              } !pointer-events-auto`}
              disabled={vote?.isUpvoted}
              variant="outline"
              onClick={handleUpvote}
            >
              <ThumbUpIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {vote?.isUpvoted ? '評価済み' : '高評価'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={`py-1 px-2 h-fit ${
                vote && !vote.isUpvoted
                  ? 'text-primary'
                  : 'text-muted-foreground'
              } !pointer-events-auto`}
              disabled={vote && !vote.isUpvoted}
              variant="outline"
              onClick={handleDownvote}
            >
              <ThumbDownIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {vote && !vote.isUpvoted ? '評価済み' : '低評価'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    return true;
  },
);
