export interface SavedFood {
  name: string;
  unit: string;
  quantity: number;
  calories: number;
  proteins: number;
  lipids: number;
  carbs: number;
  fibers: number;
}

const STORAGE_KEY = 'sanitrack_saved_foods';

function loadSavedFoods(): SavedFood[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedFood[];
  } catch {
    return [];
  }
}

function saveSavedFoods(foods: SavedFood[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(foods));
}

export function getSavedFoods(): SavedFood[] {
  return loadSavedFoods();
}

export function saveFood(food: SavedFood): void {
  const foods = loadSavedFoods();
  const existing = foods.findIndex(
    (f) => f.name.toLowerCase() === food.name.toLowerCase()
  );
  if (existing >= 0) {
    foods[existing] = food;
  } else {
    foods.push(food);
  }
  saveSavedFoods(foods);
}

export function removeSavedFood(name: string): void {
  const foods = loadSavedFoods().filter(
    (f) => f.name.toLowerCase() !== name.toLowerCase()
  );
  saveSavedFoods(foods);
}

export function isFoodSaved(name: string): boolean {
  return loadSavedFoods().some(
    (f) => f.name.toLowerCase() === name.toLowerCase()
  );
}