import { createClient } from '@supabase/supabase-js';

// サービスロール（管理者権限）を持つSupabaseクライアントを作成
export const createAdminClient = () => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL || 
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error('Missing Supabase admin credentials');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}; 