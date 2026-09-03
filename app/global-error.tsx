'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body style={{ backgroundColor: '#09090b', color: '#f4f4f5', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Произошла ошибка</h2>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500 }}
        >
          Попробовать снова
        </button>
      </body>
    </html>
  );
}
