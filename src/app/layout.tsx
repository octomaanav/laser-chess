import type { Metadata, Viewport } from 'next';
import { Lilita_One, Nunito } from 'next/font/google';
import './globals.css';

const lilita = Lilita_One({ subsets: ['latin'], weight: ['400'], variable: '--font-display' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Laser Chess — Online',
  description: 'A cute little real-time Laser Chess. Deflect the beam, burn the enemy Pharaoh, play a friend.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f7efe1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lilita.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
