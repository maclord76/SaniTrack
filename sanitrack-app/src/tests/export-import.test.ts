import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockTables } = vi.hoisted(() => {
  const makeTable = () => ({
    clear: vi.fn(async () => undefined),
    bulkGet: vi.fn(
      async (keys: readonly string[]): Promise<unknown[]> => keys.map(() => undefined),
    ),
    bulkAdd: vi.fn(async (_entries: unknown[]) => undefined),
    toArray: vi.fn(async () => []),
  });

  const mockTables = {
    bloodAnalyses: makeTable(),
    physicalActivities: makeTable(),
    weightBMI: makeTable(),
    sleep: makeTable(),
    bloodPressure: makeTable(),
    nutrition: makeTable(),
    pollenAllergenScores: makeTable(),
  };

  return {
    mockTables,
    mockDb: {
      ...mockTables,
      transaction: vi.fn(
        async (_mode: string, _tables: unknown[], work: () => Promise<void>) => work(),
      ),
    },
  };
});

vi.mock('../db/database', () => ({ db: mockDb }));

import { importAllData } from '../db/export-import';

const localStorageMock = {
  getItem: vi.fn((_key: string) => null),
  setItem: vi.fn((_key: string, _value: string) => undefined),
  removeItem: vi.fn((_key: string) => undefined),
};

const baseImport = {
  version: '1',
  exportedAt: '2026-07-18T00:00:00.000Z',
  bloodAnalysis: [],
  physicalActivity: [],
  weightBMI: [],
  sleep: [],
  bloodPressure: [],
  nutrition: [],
  pollenAllergenScores: [],
};

const existingWeight = {
  id: 'weight-existing',
  date: '2026-07-16T08:00:00.000Z',
  mass: 80,
  height: 180,
  bmi: 24.69,
  createdAt: '2026-07-16T08:00:00.000Z',
};

const newWeight = {
  id: 'weight-new',
  date: '2026-07-17T08:00:00.000Z',
  mass: 79,
  height: 180,
  bmi: 24.38,
  createdAt: '2026-07-17T08:00:00.000Z',
};

const existingPollen = {
  taxon: 'BETULA',
  name: 'Bouleau',
  score: 3,
  createdAt: '2026-07-16T08:00:00.000Z',
  updatedAt: '2026-07-16T08:00:00.000Z',
};

const newPollen = {
  taxon: 'POACEAE',
  name: 'Graminées',
  score: 4,
  createdAt: '2026-07-17T08:00:00.000Z',
  updatedAt: '2026-07-17T08:00:00.000Z',
};

const importedSettings = {
  height: 175,
  weight: 75,
  sex: 'male' as const,
  age: 45,
  lifestyle: 'active',
  metabolismeBase: null,
  besoins: null,
  thresholds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', localStorageMock);

  for (const table of Object.values(mockTables)) {
    table.bulkGet.mockImplementation(async (keys) => keys.map(() => undefined));
  }
});

describe('importAllData', () => {
  it('ajoute uniquement les nouvelles clés en mode complément', async () => {
    mockTables.weightBMI.bulkGet.mockResolvedValue([existingWeight, undefined]);
    mockTables.pollenAllergenScores.bulkGet.mockResolvedValue([existingPollen, undefined]);

    const result = await importAllData(
      {
        ...baseImport,
        weightBMI: [existingWeight, newWeight, { ...newWeight }],
        pollenAllergenScores: [existingPollen, newPollen, { ...newPollen }],
        settings: importedSettings,
      },
      { clearExisting: false },
    );

    expect(mockTables.weightBMI.bulkGet).toHaveBeenCalledWith([
      'weight-existing',
      'weight-new',
    ]);
    expect(mockTables.weightBMI.bulkAdd).toHaveBeenCalledWith([newWeight]);
    expect(mockTables.pollenAllergenScores.bulkGet).toHaveBeenCalledWith([
      'BETULA',
      'POACEAE',
    ]);
    expect(mockTables.pollenAllergenScores.bulkAdd).toHaveBeenCalledWith([newPollen]);
    expect(result).toEqual({ imported: 2, errors: [] });
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(localStorageMock.removeItem).not.toHaveBeenCalled();

    for (const table of Object.values(mockTables)) {
      expect(table.clear).not.toHaveBeenCalled();
    }
  });

  it('remplace les tables et restaure complètement les réglages', async () => {
    const result = await importAllData(
      {
        ...baseImport,
        weightBMI: [newWeight],
        settings: importedSettings,
      },
      { clearExisting: true },
    );

    for (const table of Object.values(mockTables)) {
      expect(table.clear).toHaveBeenCalledOnce();
      expect(table.bulkGet).not.toHaveBeenCalled();
    }

    expect(mockTables.weightBMI.bulkAdd).toHaveBeenCalledWith([newWeight]);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('settings_height', '175');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('settings_thresholds');
    expect(result).toEqual({ imported: 1, errors: [] });
  });
});
