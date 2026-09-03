import type { Metadata } from 'next';
import './globals.css';



export const metadata: Metadata = {
  title: 'FC MOEX - Margin Calculator',
  description: 'Терминал калькулятора фьючерсов и маржи Мосбиржи (ETS 2026)',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="bg-zinc-950 text-zinc-50 min-h-screen antialiased dark" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
