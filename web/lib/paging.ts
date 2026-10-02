/** Grid shows this many cafes, and "Show more" adds this many more to the same list. */
export const PAGE_SIZE = 24;

/** How many cards "Show more" adds: a full page, or whatever is left. */
export const nextBatch = (shown: number, total: number): number => Math.min(PAGE_SIZE, Math.max(0, total - shown));
