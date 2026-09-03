'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 p-6 text-center">
      <h1 className="text-4xl font-black mb-2 text-blue-500">404</h1>
      <p className="text-lg text-zinc-400 mb-6">Страница не найдена</p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-medium transition-all"
      >
        Вернуться на главную
      </Link>
    </div>
  );
}
