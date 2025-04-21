'use client';

import { useFormStatus } from 'react-dom';

import { LoaderIcon } from '@/components/icons';

import { Button } from './ui/button';

export function SubmitButton({
  children,
  isSuccessful,
  isLoading,
}: {
  children: React.ReactNode;
  isSuccessful?: boolean;
  isLoading?: boolean;
}) {
  const { pending } = useFormStatus();
  const isLoadingState = isLoading || pending;
  const isDisabled = isLoadingState || isSuccessful;

  return (
    <Button
      type={isLoadingState ? 'button' : 'submit'}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      className="relative"
    >
      {children}

      {(isLoadingState || isSuccessful) && (
        <span className="animate-spin absolute right-4">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {isLoadingState || isSuccessful ? 'Loading' : 'Submit form'}
      </output>
    </Button>
  );
}
