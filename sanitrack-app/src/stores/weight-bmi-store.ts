import { create } from 'zustand';
import type { WeightBMI, DateRange } from '../models/types';
import { weightBMIRepository } from '../services/storage';


interface WeightBMIState {
  records: WeightBMI[];
  loading: boolean;
  error: string | null;
  currentRecord: WeightBMI | null;
}

interface WeightBMIActions {
  fetchAll: () => Promise<void>;
  addRecord: (record: WeightBMI) => Promise<void>;
  updateRecord: (id: string, changes: Partial<Omit<WeightBMI, 'id'>>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getByDateRange: (range: DateRange) => Promise<WeightBMI[]>;
}

export type WeightBMIStore = WeightBMIState & { actions: WeightBMIActions };

export const useWeightBMIStore = create<WeightBMIStore>((set) => ({
  records: [],
  loading: false,
  error: null,
  currentRecord: null,

  actions: {
    fetchAll: async () => {
      set({ loading: true, error: null });
      try {
        const records = await weightBMIRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
      }
    },

    addRecord: async (record: WeightBMI) => {
      set({ loading: true, error: null });
      try {
        await weightBMIRepository.add(record);
        const records = await weightBMIRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    updateRecord: async (id: string, changes: Partial<Omit<WeightBMI, 'id'>>) => {
      set({ loading: true, error: null });
      try {
        await weightBMIRepository.update(id, changes);
        const records = await weightBMIRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    deleteRecord: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await weightBMIRepository.delete(id);
        const records = await weightBMIRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    getByDateRange: async (range: DateRange) => {
      try {
        return await weightBMIRepository.getByDateRange(range);
      } catch (e) {
        set({ error: (e as Error).message });
        return [];
      }
    },
  },
}));