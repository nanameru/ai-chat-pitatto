'use client';

import type { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { motion } from 'framer-motion';
import { memo } from 'react';

import { Button } from './ui/button';
import { SparklesIcon } from './icons';

interface Suggestion {
  title: string;
  description: string;
  onClick: () => void;
}

interface SuggestedActionsProps {
  suggestions?: Suggestion[];
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions & { xSearchEnabled?: boolean },
  ) => Promise<string | null | undefined>;
  chatId: string;
}

function PureSuggestedActions({
  suggestions = [],
  append,
  chatId,
}: SuggestedActionsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-3 w-full max-w-3xl mx-auto">
      {suggestions.map((suggestion, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ 
            delay: 0.1 * index,
            duration: 0.3,
            type: "spring",
            stiffness: 100 
          }}
          key={`suggested-action-${suggestion.title}-${index}`}
          className={index > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            className="w-full h-auto p-4 justify-start hover:bg-primary/5 hover:text-primary border border-primary/10 hover:border-primary/20 transition-all duration-200 rounded-xl group"
            onClick={suggestion.onClick}
          >
            <div className="flex flex-row items-start gap-3 text-left">
              <div className="mt-1 size-5 bg-gradient-to-br from-primary/10 to-primary/20 rounded-lg flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/30 transition-all duration-200">
                <SparklesIcon size={14} className="text-primary/70 group-hover:text-primary transition-colors duration-200" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1 text-base group-hover:text-primary transition-colors duration-200">
                  {suggestion.title}
                </div>
                <div className="text-sm text-muted-foreground group-hover:text-primary/70 transition-colors duration-200">
                  {suggestion.description}
                </div>
              </div>
            </div>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
