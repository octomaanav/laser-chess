import type { Color } from '@/game/types';

// The two sides are `red` and `silver` internally, but the "silver" pieces are
// rendered teal - so we show a matching display name to users.
export const COLOR_LABEL: Record<Color, string> = { red: 'Red', silver: 'Teal' };
export const colorName = (c: Color): string => COLOR_LABEL[c];
