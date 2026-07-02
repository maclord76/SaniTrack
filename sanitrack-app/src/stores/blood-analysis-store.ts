import { create } from 'zustand';
import type { BloodAnalysis, DateRange } from '../models/types';
import { bloodAnalysisRepository } from '../services/storage';


interface BloodAnalysisState {
  records: BloodAnalysis[];
  loading: boolean;
  error: string | null;
  currentRecord: BloodAnalysis | null;
}

interface BloodAnalysisActions {
  fetchAll: () => Promise<void>;
  addRecord: (record: BloodAnalysis) => Promise<void>;
  updateRecord: (id: string, changes: Partial<Omit<BloodAnalysis, 'id'>>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getByDateRange: (range: DateRange) => Promise<BloodAnalysis[]>;
}

export type BloodAnalysisStore = BloodAnalysisState & { actions: BloodAnalysisActions };

export const useBloodAnalysisStore = create<BloodAnalysisStore>((set) => ({
  records: [],
  loading: false,
  error: null,
  currentRecord: null,

  actions: {
    fetchAll: async () => {
      set({ loading: true, error: null });
      try {
        const records = await bloodAnalysisRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
      }
    },

    addRecord: async (record: BloodAnalysis) => {
      set({ loading: true, error: null });
      try {
        await bloodAnalysisRepository.add(record);
        const records = await bloodAnalysisRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    updateRecord: async (id: string, changes: Partial<Omit<BloodAnalysis, 'id'>>) => {
      set({ loading: true, error: null });
      try {
        await bloodAnalysisRepository.update(id, changes);
        const records = await bloodAnalysisRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    deleteRecord: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await bloodAnalysisRepository.delete(id);
        const records = await bloodAnalysisRepository.getAllSorted();
        set({ records, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    getByDateRange: async (range: DateRange) => {
      try {
        return await bloodAnalysisRepository.getByDateRange(range);
      } catch (e) {
        set({ error: (e as Error).message });
        return [];
      }
    },
  },
}));