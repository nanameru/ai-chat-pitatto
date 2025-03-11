'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export function UserAuthStatus() {
  useEffect(() => {
    const checkAuthStatus = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      
      console.log('=== ユーザー認証状態 ===');
      if (error) {
        console.error('認証エラー:', error.message);
        return;
      }
      
      if (data.session) {
        console.log('ログイン状態: ログイン済み');
        console.log('ユーザーID:', data.session.user.id);
        console.log('メールアドレス:', data.session.user.email);
        console.log('ユーザー名:', data.session.user.user_metadata?.name || 'なし');
        console.log('ロール:', data.session.user.role);
      } else {
        console.log('ログイン状態: 未ログイン (匿名ユーザー)');
      }
      console.log('========================');
    };

    checkAuthStatus();
  }, []);

  // このコンポーネントは何も表示しない
  return null;
} 