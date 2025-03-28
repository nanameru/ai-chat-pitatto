import { useState, useCallback } from 'react';
import { Message } from 'ai';

interface UseComputerUseOptions {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useComputerUse(options: UseComputerUseOptions = {}) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const executeComputerUse = useCallback(
    async (messages: Message[], model: string = 'claude-computer-use') => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/computer-use', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            model,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || 'Computer Use request failed');
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }
        
        // ストリーミングレスポンスの処理
        const decoder = new TextDecoder();
        let result = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          result += chunk;
          
          // ここでUIの更新などを行うことができます
          // 例: onChunk(chunk) など
        }
        
        options.onSuccess?.();
        return result;
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );
  
  return {
    executeComputerUse,
    isLoading,
    error,
  };
}
