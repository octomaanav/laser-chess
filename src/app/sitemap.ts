import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { GAMES, hrefFor } from '@/lib/games';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    // Live games are the real destinations; upcoming ones are listed at lower priority.
    ...GAMES.map((g) => ({
      url: `${SITE_URL}${hrefFor(g)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: g.status === 'live' ? 0.9 : 0.4,
    })),
  ];
}
