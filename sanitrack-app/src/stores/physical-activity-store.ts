import { create } from 'zustand';
import type { PhysicalActivity, DateRange } from '../models/types';
import { physicalActivityRepository } from '../services/storage';


interface PhysicalActivityState {
  records: PhysicalActivity[];
  loading: boolean;
  error: string | null;
  currentRecord: PhysicalActivity | null;
}

interface PhysicalActivityActions {
  fetchAll: () => Promise<void>;
  addRecord: (record: PhysicalActivity) => Promise<void>;
  updateRecord: (id: string, changes: Partial<Omit<PhysicalActivity, 'id'>>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getByDateRange: (range: DateRange) => Promise<PhysicalActivity[]>;
}

export type PhysicalActivityStore = PhysicalActivityState & { actions: PhysicalActivityActions };

export const usePhysicalActivityStore = create<PhysicalActivityStore>((set) => ({
  records: [],
  loading: false,
  error: null,
  currentRecord: null,

  actions: {
    fetchAll: async () => {
      set({ loading: true, error: null });
      try {
        const records = await physicalActivityRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
      }
    },

    addRecord: async (record: PhysicalActivity) => {
      set({ loading: true, error: null });
      try {
        await physicalActivityRepository.add(record);
        const records = await physicalActivityRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    updateRecord: async (id: string, changes: Partial<Omit<PhysicalActivity, 'id'>>) => {
      set({ loading: true, error: null });
      try {
        await physicalActivityRepository.update(id, changes);
        const records = await physicalActivityRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    deleteRecord: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await physicalActivityRepository.delete(id);
        const records = await physicalActivityRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    getByDateRange: async (range: DateRange) => {
      try {
        return await physicalActivityRepository.getByDateRange(range);
      } catch (e) {
        set({ error: (e as Error).message });
        return [];
      }
    },
  },
}));