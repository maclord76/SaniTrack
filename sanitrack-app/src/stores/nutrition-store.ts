import { create } from 'zustand';
import type { NutritionEntry, DateRange } from '../models/types';
import { nutritionRepository } from '../services/storage';


interface NutritionState {
  records: NutritionEntry[];
  loading: boolean;
  error: string | null;
  currentRecord: NutritionEntry | null;
}

interface NutritionActions {
  fetchAll: () => Promise<void>;
  addRecord: (record: NutritionEntry) => Promise<void>;
  updateRecord: (id: string, changes: Partial<Omit<NutritionEntry, 'id'>>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getByDateRange: (range: DateRange) => Promise<NutritionEntry[]>;
}

export type NutritionStore = NutritionState & { actions: NutritionActions };

export const useNutritionStore = create<NutritionStore>((set) => ({
  records: [],
  loading: false,
  error: null,
  currentRecord: null,

  actions: {
    fetchAll: async () => {
      set({ loading: true, error: null });
      try {
        const records = await nutritionRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
      }
    },

    addRecord: async (record: NutritionEntry) => {
      set({ loading: true, error: null });
      try {
        await nutritionRepository.add(record);
        const records = await nutritionRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    updateRecord: async (id: string, changes: Partial<Omit<NutritionEntry, 'id'>>) => {
      set({ loading: true, error: null });
      try {
        await nutritionRepository.update(id, changes);
        const records = await nutritionRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    deleteRecord: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await nutritionRepository.delete(id);
        const records = await nutritionRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    getByDateRange: async (range: DateRange) => {
      try {
        return await nutritionRepository.getByDateRange(range);
      } catch (e) {
        set({ error: (e as Error).message });
        return [];
      }
    },
  },
}));