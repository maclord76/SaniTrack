import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from './Modal';

interface CityResult {
  code: string;
  nom: string;
  codesPostaux: string[];
}

interface CitySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (codeInsee: string, cityName: string) => void;
}

function CitySearchModal({ isOpen, onClose, onSelect }: CitySearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchCities = useCallback(async (search: string) => {
    if (search.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(search)}&fields=code,nom,codesPostaux&boost=population&limit=20`
      );
      if (!response.ok) throw new Error(`Erreur API (${response.status})`);
      const data: CityResult[] = await response.json();
      setResults(data);
      if (data.length === 0) {
        setError('Aucune commune trouvée');
      }
    } catch (err) {
      setError((err as Error).message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchCities(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchCities]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSelect = (city: CityResult) => {
    onSelect(city.code, city.code);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rechercher une commune" className="max-w-lg">
      <div className="space-y-4">
        <div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom de la commune (ex: Paris, Lille...)"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">Recherche...</span>
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {results.length > 0 && !loading && (
          <ul className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
            {results.map((city) => (
              <li key={city.code}>
                <button
                  type="button"
                  onClick={() => handleSelect(city)}
                  className="w-full px-3 py-2.5 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <span className="font-medium">{city.nom}</span>
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    {city.codesPostaux[0] ?? '?'} — Code INSEE : {city.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Données fournies par l'API géographique du gouvernement français (geo.api.gouv.fr)
        </p>
      </div>
    </Modal>
  );
}

export { CitySearchModal, type CitySearchModalProps };