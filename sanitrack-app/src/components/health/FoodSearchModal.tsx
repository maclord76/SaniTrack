import { useState, useMemo, useCallback, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useCiqualData, type CiqualFoodParsed } from '../../hooks/useCiqualData';
import clsx from 'clsx';

interface FoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (food: CiqualFoodParsed) => void;
  initialSearch?: string;
}

type SortField = 'nom' | 'groupe' | 'energie';
type SortDirection = 'asc' | 'desc';

function FoodSearchModal({ isOpen, onClose, onSelect, initialSearch }: FoodSearchModalProps) {
  const { data, loading, error, groups, favorites, toggleFavorite, isFavorite } = useCiqualData();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && initialSearch) {
      setSearch(initialSearch);
    }
  }, [isOpen, initialSearch]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('nom');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const filteredData = useMemo(() => {
    let filtered = data;
    if (showFavoritesOnly) {
      filtered = filtered.filter((item) => isFavorite(item.nom));
    }
    if (selectedGroup) {
      filtered = filtered.filter((item) => item.groupe === selectedGroup);
    }
    if (search.trim()) {
      const words = search.toLowerCase().trim().split(/\s+/);
      filtered = filtered.filter((item) => {
        const nom = item.nom.toLowerCase();
        const groupe = item.groupe.toLowerCase();
        return words.every((word) => nom.includes(word) || groupe.includes(word));
      });
    }
    return filtered;
  }, [data, search, selectedGroup, showFavoritesOnly, isFavorite]);

  const availableGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const words = search.toLowerCase().trim().split(/\s+/);
    const matchingGroups = new Set<string>();
    for (const item of data) {
      const nom = item.nom.toLowerCase();
      const groupe = item.groupe.toLowerCase();
      if (words.every((word) => nom.includes(word) || groupe.includes(word))) {
        matchingGroups.add(item.groupe);
      }
    }
    return groups.filter((g) => matchingGroups.has(g));
  }, [data, search, groups]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'nom') {
        comparison = a.nom.localeCompare(b.nom, 'fr');
      } else if (sortField === 'groupe') {
        comparison = a.groupe.localeCompare(b.groupe, 'fr');
      } else if (sortField === 'energie') {
        comparison = a.energie - b.energie;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted.slice(0, 100);
  }, [filteredData, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="h-3.5 w-3.5 text-slate-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const handleSelect = useCallback(
    (food: CiqualFoodParsed) => {
      onSelect(food);
      setSearch('');
      setSelectedGroup('');
      setShowFavoritesOnly(false);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleClose = useCallback(() => {
    setSearch('');
    setSelectedGroup('');
    setShowFavoritesOnly(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Rechercher un aliment" className="max-w-2xl">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher un aliment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pl-10 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          title="Filtrer par groupe d'aliments"
        >
          <option value="">Tous les groupes</option>
          {availableGroups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              showFavoritesOnly
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
            )}
          >
            <svg
              className={clsx('h-4 w-4', showFavoritesOnly ? 'fill-current' : '')}
              fill={showFavoritesOnly ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            Favoris
          </button>
          {showFavoritesOnly && favorites.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({favorites.length})
            </span>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg
              className="h-8 w-8 animate-spin text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        {!loading && sortedData.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {showFavoritesOnly
              ? 'Aucun favori enregistré. Cliquez sur l\'étoile pour ajouter des favoris.'
              : 'Aucun aliment trouvé'}
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {sortedData.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-400 w-8"></th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleSort('nom')}
                      className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      Nom
                      <SortIcon field="nom" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                    <button
                      type="button"
                      onClick={() => handleSort('groupe')}
                      className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      Groupe
                      <SortIcon field="groupe" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleSort('energie')}
                      className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      kcal
                      <SortIcon field="energie" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((item, idx) => (
                  <tr
                    key={`${item.nom}-${idx}`}
                    className="cursor-pointer border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    onClick={() => handleSelect(item)}
                  >
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item.nom);
                        }}
                        className="text-slate-400 hover:text-amber-500"
                        title={isFavorite(item.nom) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      >
                        <svg
                          className="h-4 w-4"
                          fill={isFavorite(item.nom) ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="px-2 py-2 font-medium text-slate-900 dark:text-slate-100">{item.nom}</td>
                    <td className="px-2 py-2 text-slate-500 dark:text-slate-400 hidden sm:table-cell text-xs">{item.groupe}</td>
                    <td className="px-2 py-2 text-right text-slate-700 dark:text-slate-300">{item.energie}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Valeurs pour 100g
        </div>
      </div>
    </Modal>
  );
}

export { FoodSearchModal, type FoodSearchModalProps };