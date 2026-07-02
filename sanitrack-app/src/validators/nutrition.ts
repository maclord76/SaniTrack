import { z } from 'zod';

export const nutritionFoodSchema = z.object({
  name: z.string().min(1, "Le nom de l'aliment est requis"),
  quantity: z.number().min(0, 'La quantité doit être non négative'),
  unit: z.string().min(1, "L'unité est requise"),
  barcode: z.string().optional(),
  calories: z.number().min(0, 'Les calories doivent être non négatives').max(50000, 'Les calories doivent être au plus 50000'),
  proteins: z.number().min(0, 'Les protéines doivent être non négatives').max(50000, 'Les protéines doivent être au plus 50000'),
  lipids: z.number().min(0, 'Les lipides doivent être non négatifs').max(50000, 'Les lipides doivent être au plus 50000'),
  carbs: z.number().min(0, 'Les glucides doivent être non négatifs').max(50000, 'Les glucides doivent être au plus 50000'),
  fibers: z.number().min(0, 'Les fibres doivent être non négatives').max(50000, 'Les fibres doivent être au plus 50000'),
}).passthrough();

const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

export const nutritionEntrySchema = z
  .object({
    id: z.string().min(1),
    date: z.string().datetime(),
    mealType: mealTypeSchema,
    foods: z.array(nutritionFoodSchema).min(1, 'Au moins un aliment est requis'),
    totalCalories: z.number().min(0, 'Les calories totales doivent être non négatives').max(50000, 'Les calories totales doivent être au plus 50000'),
    totalProteins: z.number().min(0, 'Les protéines totales doivent être non négatives').max(50000, 'Les protéines totales doivent être au plus 50000'),
    totalLipids: z.number().min(0, 'Les lipides totaux doivent être non négatifs').max(50000, 'Les lipides totaux doivent être au plus 50000'),
    totalCarbs: z.number().min(0, 'Les glucides totaux doivent être non négatifs').max(50000, 'Les glucides totaux doivent être au plus 50000'),
    totalFibers: z.number().min(0, 'Les fibres totales doivent être non négatives').max(50000, 'Les fibres totales doivent être au plus 50000'),
    createdAt: z.string().datetime(),
  })
  .passthrough()
  .refine((data) => {
    if (data.foods.length === 0) return true;
    const sumCalories = data.foods.reduce((sum, f) => sum + f.calories, 0);
    return Math.abs(data.totalCalories - sumCalories) < 1;
  }, {
    message: 'Le total des calories doit être égal à la somme des calories des aliments',
    path: ['totalCalories'],
  })
  .refine((data) => {
    if (data.foods.length === 0) return true;
    const sumProteins = data.foods.reduce((sum, f) => sum + f.proteins, 0);
    return Math.abs(data.totalProteins - sumProteins) < 1;
  }, {
    message: 'Le total des protéines doit être égal à la somme des protéines des aliments',
    path: ['totalProteins'],
  })
  .refine((data) => {
    if (data.foods.length === 0) return true;
    const sumLipids = data.foods.reduce((sum, f) => sum + f.lipids, 0);
    return Math.abs(data.totalLipids - sumLipids) < 1;
  }, {
    message: 'Le total des lipides doit être égal à la somme des lipides des aliments',
    path: ['totalLipids'],
  })
  .refine((data) => {
    if (data.foods.length === 0) return true;
    const sumCarbs = data.foods.reduce((sum, f) => sum + f.carbs, 0);
    return Math.abs(data.totalCarbs - sumCarbs) < 1;
  }, {
    message: 'Le total des glucides doit être égal à la somme des glucides des aliments',
    path: ['totalCarbs'],
  })
  .refine((data) => {
    if (data.foods.length === 0) return true;
    const sumFibers = data.foods.reduce((sum, f) => sum + f.fibers, 0);
    return Math.abs(data.totalFibers - sumFibers) < 1;
  }, {
    message: 'Le total des fibres doit être égal à la somme des fibres des aliments',
    path: ['totalFibers'],
  });