import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { GAMES, hrefFor } from '@/lib/games';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const liveGames = GAMES.filter((g) => g.status === 'live');
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...liveGames.map((g) => ({
      url: `${SITE_URL}${hrefFor(g)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  ];
}
