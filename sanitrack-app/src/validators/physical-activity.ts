import { z } from 'zod';

export const physicalActivitySchema = z
  .object({
    id: z.string().min(1),
    date: z.string().datetime(),
    distance: z.number().min(0, 'La distance doit être non négative').max(500, 'La distance doit être au plus 500 km'),
    duration: z.number().min(0, 'La durée doit être non négative').max(86400, 'La durée doit être au plus 86400 secondes'),
    totalCalories: z.number().min(0, 'Les calories doivent être non négatives').max(50000, 'Les calories doivent être au plus 50000'),
    averagePace: z.number().min(0, "L'allure moyenne doit être non négative").max(120, "L'allure moyenne doit être au plus 120 min/km"),
    averageSpeed: z.number().min(0, 'La vitesse moyenne doit être non négative').max(100, 'La vitesse moyenne doit être au plus 100 km/h'),
    averageCadence: z.number().min(0, 'La cadence doit être non négative').max(300, 'La cadence doit être au plus 300 pas/min'),
    averageStepLength: z.number().min(0, 'La longueur de pas doit être non négative').max(200, 'La longueur de pas doit être au plus 200 cm'),
    steps: z.number().min(0, 'Les pas doivent être non négatifs').max(200000, 'Les pas doivent être au plus 200000'),
    averageHeartRate: z.number().min(0, 'La fréquence cardiaque doit être non négative').max(250, 'La fréquence cardiaque doit être au plus 250 bpm'),
    aerobicTrainingStress: z.number().min(0, "Le stress d'entraînement aérobie doit être non négatif").max(100, "Le stress d'entraînement aérobie doit être au plus 100"),
    anaerobicTrainingStress: z.number().min(0, "Le stress d'entraînement anaérobie doit être non négatif").max(100, "Le stress d'entraînement anaérobie doit être au plus 100"),
    createdAt: z.string().datetime(),
  })
  .passthrough();