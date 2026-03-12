// ------------------------------------------------------------------
// Zod Validation Schemas for Global Header Search
// Pattern: Validation Layer (Zod v4)
// Why: Centralizes query validation for the global search endpoint
//      and keeps HTTP handlers thin and predictable.
// ------------------------------------------------------------------

import { z } from 'zod';

/**
 * Validates query parameters for searching buildings and activities
 * in the active project context.
 */
export const globalSearchQuerySchema = z.object({
    q: z
        .string({ error: 'Search query is required' })
        .trim()
        .min(2, 'Type at least 2 characters to search')
        .max(80, 'Search query is too long'),
    limit: z.coerce
        .number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(20, 'Limit cannot exceed 20')
        .default(8),
});

/** Inferred TypeScript type from the search query schema. */
export type TGlobalSearchQueryInput = z.infer<typeof globalSearchQuerySchema>;
