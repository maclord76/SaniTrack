import { z } from 'zod';

export const bloodAnalysisSchema = z
  .object({
    id: z.string().min(1),
    date: z.string().datetime(),
    tc: z
      .number()
      .min(0, 'Le cholestérol total doit être positif')
      .max(15.0, 'Le cholestérol total doit être au plus 15.0 mmol/L'),
    hdl: z
      .number()
      .min(0, 'Le HDL doit être positif')
      .max(5.0, 'Le HDL doit être au plus 5.0 mmol/L'),
    tg: z
      .number()
      .min(0, 'Les triglycérides doivent être positifs')
      .max(20.0, 'Les triglycérides doivent être au plus 20.0 mmol/L'),
    ldl: z
      .number()
      .min(0, 'Le LDL doit être positif')
      .max(12.0, 'Le LDL doit être au plus 12.0 mmol/L'),
    tcHdlRatio: z
      .number()
      .min(0, 'Le rapport TC/HDL doit être positif')
      .max(25.0, 'Le rapport TC/HDL doit être au plus 25.0'),
    glucose: z
      .number()
      .min(0, 'La glycémie doit être positive')
      .max(40.0, 'La glycémie doit être au plus 40.0 mmol/L'),
    createdAt: z.string().datetime(),
  })
  .passthrough()
  .refine((data) => data.ldl === 0 || data.ldl < data.tc, {
    message: 'Le LDL doit être inférieur au cholestérol total',
    path: ['ldl'],
  });