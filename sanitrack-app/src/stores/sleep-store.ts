import { create } from 'zustand';
import type { Sleep, DateRange } from '../models/types';
import { sleepRepository } from '../services/storage';


interface SleepState {
  records: Sleep[];
  loading: boolean;
  error: string | null;
  currentRecord: Sleep | null;
}

interface SleepActions {
  fetchAll: () => Promise<void>;
  addRecord: (record: Sleep) => Promise<void>;
  updateRecord: (id: string, changes: Partial<Omit<Sleep, 'id'>>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getByDateRange: (range: DateRange) => Promise<Sleep[]>;
}

export type SleepStore = SleepState & { actions: SleepActions };

export const useSleepStore = create<SleepStore>((set) => ({
  records: [],
  loading: false,
  error: null,
  currentRecord: null,

  actions: {
    fetchAll: async () => {
      set({ loading: true, error: null });
      try {
        const records = await sleepRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
      }
    },

    addRecord: async (record: Sleep) => {
      set({ loading: true, error: null });
      try {
        await sleepRepository.add(record);
        const records = await sleepRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    updateRecord: async (id: string, changes: Partial<Omit<Sleep, 'id'>>) => {
      set({ loading: true, error: null });
      try {
        await sleepRepository.update(id, changes);
        const records = await sleepRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    deleteRecord: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await sleepRepository.delete(id);
        const records = await sleepRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    getByDateRange: async (range: DateRange) => {
      try {
        return await sleepRepository.getByDateRange(range);
      } catch (e) {
        set({ error: (e as Error).message });
        return [];
      }
    },
  },
}));