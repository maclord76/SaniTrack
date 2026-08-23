import { z } from 'zod';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Le format doit être hh:mm');

export const sleepSchema = z
  .object({
    id: z.string().min(1),
    date: z.string().datetime(),
    bedTime: timeSchema.optional(),
    wakeTime: timeSchema.optional(),
    totalSleep: z.number().min(0, 'Le sommeil total doit être non négatif').max(1440, 'Le sommeil total doit être au plus 1440 minutes'),
    deepSleep: z.number().min(0, 'Le sommeil profond doit être non négatif').max(1440, 'Le sommeil profond doit être au plus 1440 minutes'),
    lightSleep: z.number().min(0, 'Le sommeil léger doit être non négatif').max(1440, 'Le sommeil léger doit être au plus 1440 minutes'),
    remSleep: z.number().min(0, 'Le sommeil paradoxal doit être non négatif').max(1440, 'Le sommeil paradoxal doit être au plus 1440 minutes'),
    efficiency: z.number().min(0, "L'efficacité doit être non négative").max(100, "L'efficacité ne peut pas dépasser 100%").optional(),
    createdAt: z.string().datetime(),
  })
  .passthrough()
  .refine((data) => data.deepSleep + data.lightSleep + data.remSleep <= data.totalSleep, {
    message: 'La somme du sommeil profond, léger et paradoxal ne doit pas dépasser le sommeil total',
    path: ['totalSleep'],
  });
