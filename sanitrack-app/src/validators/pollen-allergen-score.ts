import { z } from 'zod';

export const pollenAllergenScoreSchema = z.object({
  taxon: z.string().min(1),
  name: z.string().min(1),
  score: z.number().int().min(0).max(5),
  toleratedThreshold: z.number().nullable().optional(),
  reactiveThreshold: z.number().nullable().optional(),
  lastConcentration: z.number().nullable().optional(),
  lastFeedback: z.enum(['like', 'dislike']).nullable().optional(),
  observations: z.number().int().min(0).optional(),
  toleratedCount: z.number().int().min(0).optional(),
  reactiveCount: z.number().int().min(0).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
