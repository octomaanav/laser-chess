import type { Metadata, Viewport } from 'next';
import { Lilita_One, Nunito } from 'next/font/google';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const lilita = Lilita_One({ subsets: ['latin'], weight: ['400'], variable: '--font-display' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Laser Chess — Play Online Free (Real-time Multiplayer)',
    template: '%s · Laser Chess',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['laser chess', 'laser chess online', 'play laser chess', 'khet online', 'online board game', 'multiplayer strategy game', 'free browser game'],
  authors: [{ name: 'Laser Chess' }],
  category: 'games',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'Laser Chess — Play Online Free',
    description: SITE_DESCRIPTION,
    images: [{ url: '/og.png', width: 2400, height: 1520, alt: 'Laser Chess — a laser beam deflecting across the board' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Laser Chess — Play Online Free',
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f7efe1',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  image: `${SITE_URL}/og.png`,
  genre: ['Strategy', 'Board game', 'Puzzle'],
  gamePlatform: 'Web browser',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any (web browser)',
  playMode: ['MultiPlayer', 'SinglePlayer'],
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lilita.variable} ${nunito.variable}`}>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
