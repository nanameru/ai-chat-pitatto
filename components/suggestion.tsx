'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useWindowSize } from 'usehooks-ts';

import type { UISuggestion } from '@/lib/editor/suggestions';

import { CrossIcon, MessageIcon, SparklesIcon } from './icons';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { ArtifactKind } from './artifact';

export const Suggestion = ({
  suggestion,
  onApply,
  artifactKind,
}: {
  suggestion: UISuggestion;
  onApply: () => void;
  artifactKind: ArtifactKind;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { width: windowWidth } = useWindowSize();

  return (
    <AnimatePresence>
      {!isExpanded ? (
        <motion.div
          className={cn(
            'cursor-pointer text-muted-foreground hover:text-primary transition-colors duration-200 p-1.5 rounded-full hover:bg-primary/10',
            {
              'absolute -right-8': artifactKind === 'text',
              'sticky top-0 right-4': artifactKind === 'code',
            }
          )}
          onClick={() => {
            setIsExpanded(true);
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageIcon
            size={windowWidth && windowWidth < 768 ? 16 : 14}
            className="transition-transform duration-200 hover:rotate-12"
          />
        </motion.div>
      ) : (
        <motion.div
          key={suggestion.id}
          className="absolute bg-background/95 backdrop-blur-sm p-4 flex flex-col gap-3.5 rounded-2xl border border-primary/20 text-sm w-64 shadow-2xl z-50 -right-12 md:-right-16 font-sans"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: -20, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-2.5">
              <div className="size-6 bg-gradient-to-br from-primary/20 to-primary/30 rounded-full flex items-center justify-center">
                <SparklesIcon size={14} className="text-primary" />
              </div>
              <div className="font-medium bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Assistant
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setIsExpanded(false);
              }}
            >
              <CrossIcon size={12} />
            </Button>
          </div>
          <div className="text-muted-foreground leading-relaxed">
            {suggestion.description}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-fit py-1.5 px-4 rounded-full border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-colors duration-200 font-medium"
            onClick={onApply}
          >
            Apply Suggestion
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
