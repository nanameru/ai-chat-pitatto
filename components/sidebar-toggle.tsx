import type { ComponentProps } from 'react';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { SidebarToggleIcon } from './icons';
import { Button } from './ui/button';

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar, open } = useSidebar();

  // サイドバーが閉じている場合のみボタンを表示
  if (open) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          className="p-2 h-10 flex items-center justify-center"
          data-component-name="_c"
        >
          <SidebarToggleIcon size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start">サイドバーの切り替え</TooltipContent>
    </Tooltip>
  );
}
