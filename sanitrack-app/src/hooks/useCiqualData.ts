import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CiqualFood } from '../models/types';

const CIQUAL_FAVORITES_KEY = 'ciqual_favorites';

function parseFrenchNumber(value: string): number {
  if (!value || value === '-' || value === '') return 0;
  const normalized = value.replace(',', '.').trim();
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

export interface CiqualFoodParsed {
  groupe: string;
  nom: string;
  energie: number;
  proteines: number;
  glucides: number;
  lipides: number;
  sucres: number;
  fibres: number;
}

export function useCiqualData() {
  const [data, setData] = useState<CiqualFoodParsed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(CIQUAL_FAVORITES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('data/ciqual.json');
        if (!response.ok) throw new Error('Failed to load Ciqual data');
        const raw: CiqualFood[] = await response.json();
        const parsed: CiqualFoodParsed[] = raw.map((item) => ({
          groupe: item.Groupe,
          nom: item.Nom,
          energie: parseFrenchNumber(item['Energie (kcal)']),
          proteines: parseFrenchNumber(item['Protéines (g)']),
          glucides: parseFrenchNumber(item['Glucides (g)']),
          lipides: parseFrenchNumber(item['Lipides (g)']),
          sucres: parseFrenchNumber(item['Sucres (g)']),
          fibres: parseFrenchNumber(item['Fibres (g)']),
        }));
        setData(parsed);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const groups = useMemo(() => {
    const uniqueGroups = [...new Set(data.map((item) => item.groupe))];
    return uniqueGroups.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [data]);

  const toggleFavorite = useCallback((foodName: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(foodName)
        ? prev.filter((n) => n !== foodName)
        : [...prev, foodName];
      localStorage.setItem(CIQUAL_FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isFavorite = useCallback(
    (foodName: string) => favorites.includes(foodName),
    [favorites]
  );

  return {
    data,
    loading,
    error,
    groups,
    favorites,
    toggleFavorite,
    isFavorite,
  };
}