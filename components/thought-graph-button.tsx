'use client';

import React, { useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { ThoughtGraphSidebar } from './thought-graph-sidebar';
import { useThoughtGraph } from '../hooks/use-thought-graph';

interface ThoughtGraphButtonProps {
  sessionId?: string;
  className?: string;
}

export const ThoughtGraphButton: React.FC<ThoughtGraphButtonProps> = ({
  sessionId = 'default',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, error } = useThoughtGraph(sessionId);
  
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };
  
  const closeSidebar = () => {
    setIsOpen(false);
  };
  
  return (
    <>
      <button
        onClick={toggleSidebar}
        className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${className}`}
        aria-label="思考グラフを表示"
        title="思考グラフを表示"
      >
        <BrainCircuit className="w-5 h-5 text-gray-700 dark:text-zinc-300" />
      </button>
      
      {isOpen && data && (
        <ThoughtGraphSidebar
          onClose={closeSidebar}
          nodes={data.nodes}
          connections={data.connections}
          synthesizedThoughts={data.synthesizedThoughts}
          networkMetrics={data.networkMetrics}
        />
      )}
    </>
  );
};
