import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Script from 'next/script';

export const experimental_ppr = true;

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full">
        <AppSidebar user={session?.user} />
        <div className="flex-1">
          <div className="w-full">
            <SidebarInset>{children}</SidebarInset>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
