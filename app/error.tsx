'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 p-6 text-center">
      <h1 className="text-3xl font-black mb-2 text-rose-500">Что-то пошло не так</h1>
      <p className="text-base text-zinc-400 mb-6 max-w-md">
        Произошла ошибка при загрузке или расчете параметров.
      </p>
      <button
        onClick={() => reset()}
        className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-xl font-medium transition-all cursor-pointer"
      >
        Попробовать снова
      </button>
    </div>
  );
}
