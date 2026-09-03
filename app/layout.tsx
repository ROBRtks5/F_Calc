import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FC MOEX - Margin Calculator',
  description: 'Терминал калькулятора фьючерсов и маржи Мосбиржи (ETS 2026)',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark" style={{ colorScheme: 'dark' }}>
      <body className="bg-zinc-950 text-zinc-50 min-h-screen antialiased dark font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

