import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

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
  themeColor: '#0a0b10',
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
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
