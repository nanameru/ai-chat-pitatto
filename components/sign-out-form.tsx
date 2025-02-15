import Form from 'next/form';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export const SignOutForm = () => {
  const router = useRouter();

  return (
    <Form
      className="w-full"
      action={async () => {
        'use server';
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
    >
      <button
        type="submit"
        className="w-full text-left px-1 py-0.5 text-red-500"
      >
        Sign out
      </button>
    </Form>
  );
};
