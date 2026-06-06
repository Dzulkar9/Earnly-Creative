import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import AlertSystem from './components/AlertSystem';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Earnly Creative | Soroban Gated Digital Marketplace',
  description: 'Earnly Creative is a hybrid Web3 marketplace on the Stellar Network (Soroban) for creative digital assets and milestone-based custom services.',
  keywords: ['Web3', 'Stellar', 'Soroban', 'Marketplace', 'Milestone', 'Escrow', 'Digital Assets'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/Logo.png" />
      </head>
      <body className={`${inter.className} min-h-full flex flex-col bg-radial-glow bg-radial-purple bg-grid-pattern`}>
        <div className="flex-1 flex flex-col">
          <AlertSystem />
          {children}
        </div>
      </body>
    </html>
  );
}
