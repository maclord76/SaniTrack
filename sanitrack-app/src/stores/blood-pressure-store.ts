import { create } from 'zustand';
import type { BloodPressure, DateRange } from '../models/types';
import { bloodPressureRepository } from '../services/storage';


interface BloodPressureState {
  records: BloodPressure[];
  loading: boolean;
  error: string | null;
  currentRecord: BloodPressure | null;
}

interface BloodPressureActions {
  fetchAll: () => Promise<void>;
  addRecord: (record: BloodPressure) => Promise<void>;
  updateRecord: (id: string, changes: Partial<Omit<BloodPressure, 'id'>>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getByDateRange: (range: DateRange) => Promise<BloodPressure[]>;
}

export type BloodPressureStore = BloodPressureState & { actions: BloodPressureActions };

export const useBloodPressureStore = create<BloodPressureStore>((set) => ({
  records: [],
  loading: false,
  error: null,
  currentRecord: null,

  actions: {
    fetchAll: async () => {
      set({ loading: true, error: null });
      try {
        const records = await bloodPressureRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
      }
    },

    addRecord: async (record: BloodPressure) => {
      set({ loading: true, error: null });
      try {
        await bloodPressureRepository.add(record);
        const records = await bloodPressureRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    updateRecord: async (id: string, changes: Partial<Omit<BloodPressure, 'id'>>) => {
      set({ loading: true, error: null });
      try {
        await bloodPressureRepository.update(id, changes);
        const records = await bloodPressureRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    deleteRecord: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await bloodPressureRepository.delete(id);
        const records = await bloodPressureRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    getByDateRange: async (range: DateRange) => {
      try {
        return await bloodPressureRepository.getByDateRange(range);
      } catch (e) {
        set({ error: (e as Error).message });
        return [];
      }
    },
  },
}));