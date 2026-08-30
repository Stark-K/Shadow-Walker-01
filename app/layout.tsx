import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import 'leaflet/dist/leaflet.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://shadowwalker.app'),
  title: 'ShadowWalker — Navigation that keeps you in the shade',
  description:
    'ShadowWalker is a heat-aware navigation platform that compares the fastest and coolest routes so you arrive safer during heat waves.',
  openGraph: {
    title: 'ShadowWalker — Navigation that keeps you in the shade',
    description:
      'Navigation that keeps you in the shade, not just on the shortest path.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
