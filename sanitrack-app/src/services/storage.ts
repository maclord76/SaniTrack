import { db } from '../db/database';
import type { Table } from 'dexie';
import type {
  BloodAnalysis,
  PhysicalActivity,
  WeightBMI,
  Sleep,
  BloodPressure,
  NutritionEntry,
  DateRange,
} from '../models/types';

export class Repository<T extends { id: string; date: string; createdAt: string }> {
  private table: Table<T, string>;

  constructor(table: Table<T, string>) {
    this.table = table;
  }

  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  async getById(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }

  async add(entity: T): Promise<string> {
    return this.table.add(entity);
  }

  async update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<number> {
    return this.table.update(id, changes as never);
  }

  async delete(id: string): Promise<void> {
    return this.table.delete(id);
  }

  async getByDateRange(range: DateRange): Promise<T[]> {
    return this.table
      .where('date')
      .between(range.start, range.end, true, true)
      .toArray();
  }

  async getAllSorted(
    sortBy: keyof T = 'date',
    direction: 'asc' | 'desc' = 'desc',
  ): Promise<T[]> {
    const collection = this.table.orderBy(sortBy as string);
    const items = await collection.toArray();
    return direction === 'desc' ? items.reverse() : items;
  }
}

export const bloodAnalysisRepository = new Repository<BloodAnalysis>(db.bloodAnalyses);

export const physicalActivityRepository = new Repository<PhysicalActivity>(db.physicalActivities);

export const weightBMIRepository = new Repository<WeightBMI>(db.weightBMI);

export const sleepRepository = new Repository<Sleep>(db.sleep);

export const bloodPressureRepository = new Repository<BloodPressure>(db.bloodPressure);

export const nutritionRepository = new Repository<NutritionEntry>(db.nutrition);