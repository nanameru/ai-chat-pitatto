'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { PlusIcon, SidebarToggleIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile, toggleSidebar } = useSidebar();

  // 新しいチャットを開く関数
  const handleNewChat = () => {
    setOpenMobile(false);
    router.push('/');
    router.refresh();
  };

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          {/* ヘッダーに左右のボタンを配置 */}
          <div className="flex justify-between items-center p-2">
            {/* サイドバーの開閉ボタン（左側） */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleSidebar}
                  variant="ghost"
                  className="p-2 h-fit"
                >
                  <SidebarToggleIcon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="start">Toggle Sidebar</TooltipContent>
            </Tooltip>

            {/* New Chatボタン（右側） */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleNewChat}
                  variant="ghost"
                  className="p-2 h-fit"
                >
                  <PlusIcon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory />
      </SidebarContent>
      <SidebarFooter className="border-t">
        {user ? <SidebarUserNav user={user} /> : null}
      </SidebarFooter>
    </Sidebar>
  );
}
