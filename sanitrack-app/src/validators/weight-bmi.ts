import { z } from 'zod';

export const weightBMISchema = z
  .object({
    id: z.string().min(1),
    date: z.string().datetime(),
    mass: z.number().min(0, 'La masse doit être positive').max(500, 'La masse doit être au plus 500 kg'),
    height: z.number().min(0, 'La taille doit être positive').max(300, 'La taille doit être au plus 300 cm'),
    bmi: z.number().min(0, "L'IMC doit être positif").max(100, "L'IMC doit être au plus 100"),
    createdAt: z.string().datetime(),
  })
  .passthrough();