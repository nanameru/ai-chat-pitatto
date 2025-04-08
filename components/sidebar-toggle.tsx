import type { ComponentProps } from 'react';

import type { SidebarTrigger, } from '@/components/ui/sidebar';

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  // ボタンを完全に削除し、常にnullを返す
  return null;
}
