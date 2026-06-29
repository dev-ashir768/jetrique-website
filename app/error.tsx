'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="text-2xl font-semibold text-neutral-700">Something went wrong</h2>
      <p className="text-neutral-500">An unexpected error occurred.</p>
      <button onClick={reset} className="text-[#8cc63f] underline">Try again</button>
    </div>
  );
}
