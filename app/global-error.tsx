'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 className="text-3xl font-black mb-2 text-rose-500">Критическая ошибка</h1>
        <p className="text-base text-zinc-400 mb-6 max-w-md">
          Произошла непредвиденная системная ошибка приложения.
        </p>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all cursor-pointer"
        >
          Перезагрузить приложение
        </button>
      </body>
    </html>
  );
}
