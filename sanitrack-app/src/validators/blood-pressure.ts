import { z } from 'zod';

export const bloodPressureSchema = z
  .object({
    id: z.string().min(1),
    date: z.string().datetime(),
    systolic: z.number().min(0, 'La systolique doit être positive').max(300, 'La systolique doit être au plus 300 mmHg'),
    diastolic: z.number().min(0, 'La diastolique doit être positive').max(200, 'La diastolique doit être au plus 200 mmHg'),
    createdAt: z.string().datetime(),
  })
  .passthrough()
  .refine((data) => data.systolic === 0 || data.systolic > data.diastolic, {
    message: 'La systolique doit être supérieure à la diastolique',
    path: ['systolic'],
  });