import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { SocialProvider } from '@/client/social/SocialProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import PostHogProvider from '@/components/providers/PostHogProvider';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { GAMES, hrefFor } from '@/lib/games';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Game Night: Play Fun Multiplayer Games Online Free',
    template: '%s · Game Night',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['online multiplayer games', 'play games with friends', 'free browser games', 'party games online', 'laser chess', 'no download games'],
  authors: [{ name: SITE_NAME }],
  category: 'games',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'Game Night: Play Fun Multiplayer Games Online Free',
    description: SITE_DESCRIPTION,
    images: [{ url: '/og.png', width: 2400, height: 1520, alt: 'Game Night: play fun multiplayer games with friends' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Game Night: Play Fun Multiplayer Games Online Free',
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
  '@graph': [
    {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
    },
    {
      '@type': 'ItemList',
      name: `Games on ${SITE_NAME}`,
      itemListElement: GAMES.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.name,
        url: `${SITE_URL}${hrefFor(g)}`,
      })),
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {/* Rajdhani: used inline (not via CSS var) by Coup's card-art SVGs, which
            reference the literal family name directly in fontFamily props. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PostHogProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
            <SocialProvider>
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            </SocialProvider>
            <Toaster position="top-center" />
          </ThemeProvider>
        </PostHogProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
