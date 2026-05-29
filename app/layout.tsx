import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'VM.MOEX | Калькулятор вариационной маржи',
  description: 'Профессиональный калькулятор ВМ для Московской Биржи (ETS 2026)',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090b',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ru" className="dark">
      <body className="bg-zinc-950 text-zinc-50 min-h-screen antialiased dark" suppressHydrationWarning>{children}</body>
    </html>
  );
}
