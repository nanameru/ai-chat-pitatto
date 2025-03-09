'use client';

import { startTransition, useMemo, useOptimistic, useState } from 'react';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { chatModels } from '@/lib/ai/models';
import { cn } from '@/lib/utils';

import { CheckCircleFillIcon, ModelSelectorIcon } from './icons';

export function ModelSelector({
  selectedModelId,
  className,
}: {
  selectedModelId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const selectedChatModel = useMemo(
    () => chatModels.find((chatModel) => chatModel.id === optimisticModelId),
    [optimisticModelId],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button 
          variant="ghost" 
          className="flex items-center gap-1 px-2 h-8 text-sm font-medium"
        >
          <span className="flex items-center gap-1">
            {selectedChatModel?.name}
            {selectedChatModel?.id === 'chat-model-large' && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                beta
              </span>
            )}
          </span>
          <ModelSelectorIcon size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px] p-1">
        <div className="py-1 px-2 text-xs text-muted-foreground">
          {selectedChatModel?.id === 'chat-model-small' ? 'Smartest' : 'Previous generation model'}
        </div>
        {chatModels.map((chatModel) => {
          const { id } = chatModel;
          const isBeta = id === 'chat-model-large';

          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);
                });
              }}
              className="flex items-center justify-between px-2 py-1.5 rounded-md"
              data-active={id === optimisticModelId}
            >
              <div className="flex items-center gap-1">
                <span>{chatModel.name}</span>
                {isBeta && (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                    beta
                  </span>
                )}
              </div>

              {id === optimisticModelId && (
                <CheckCircleFillIcon size={16} />
              )}
            </DropdownMenuItem>
          );
        })}
        
        <div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2">
          <DropdownMenuItem className="flex items-center justify-between px-2 py-1.5 rounded-md">
            <div className="flex items-center gap-1">
              <span>Enable Search</span>
            </div>
            <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700 rounded-full relative">
              <div className="size-5 bg-white dark:bg-gray-900 rounded-full absolute right-0.5 top-0.5" />
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
