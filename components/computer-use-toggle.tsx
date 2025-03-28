import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Computer } from 'lucide-react';

interface ComputerUseToggleProps {
  isEnabled: boolean;
  onToggle: () => void;
  className?: string;
}

export function ComputerUseToggle({
  isEnabled,
  onToggle,
  className = '',
}: ComputerUseToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isEnabled ? 'default' : 'outline'}
            size="icon"
            onClick={onToggle}
            className={`${className} ${
              isEnabled ? 'bg-blue-500 hover:bg-blue-600' : ''
            }`}
            aria-label={isEnabled ? 'コンピュータ操作モードを無効にする' : 'コンピュータ操作モードを有効にする'}
          >
            <Computer className={`h-5 w-5 ${isEnabled ? 'text-white' : ''}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isEnabled ? 'コンピュータ操作モードを無効にする' : 'コンピュータ操作モードを有効にする'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
