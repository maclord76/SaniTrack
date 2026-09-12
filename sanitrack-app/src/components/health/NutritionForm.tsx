import { useCallback, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { nutritionEntryFormSchema } from '../../validators/form-schemas';
import type { NutritionEntry, NutritionFood, MealType } from '../../models/types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { FoodSearchModal } from './FoodSearchModal';
import type { CiqualFoodParsed } from '../../hooks/useCiqualData';
import { getSavedFoods, saveFood, removeSavedFood, isFoodSaved } from '../../services/saved-foods';
import { getProductByBarcode } from '../../services/open-food-facts';
import { startBarcodeScan } from '../../services/barcode-scanner';

type NutritionEntryFormData = Omit<NutritionEntry, 'id' | 'createdAt'>;

interface NutritionFormProps {
  initialData?: NutritionEntry;
  onSubmit: (data: NutritionEntryFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

type FoodInput = NutritionFood;

type InputMode = 'interne' | 'manuelle' | 'openfoodfacts';

interface FoodFieldState {
  inputMode: InputMode;
  perHundred: {
    calories: number;
    proteins: number;
    lipids: number;
    carbs: number;
    fibers: number;
  } | null;
}

type SchemaInput = {
  date: string;
  mealType: MealType;
  foods: FoodInput[];
  totalCalories: number;
  totalProteins: number;
  totalLipids: number;
  totalCarbs: number;
  totalFibers: number;
};

const mealTypeOptions = [
  { value: 'breakfast', label: 'Petit-déjeuner' },
  { value: 'lunch', label: 'Déjeuner' },
  { value: 'dinner', label: 'Dîner' },
  { value: 'snack', label: 'Collation' },
];

const unitOptions = [
  { value: 'g', label: 'grammes (g)' },
  { value: 'ml', label: 'millilitres (ml)' },
  { value: 'oz', label: 'onces (oz)' },
  { value: 'cup', label: 'tasse' },
  { value: 'serving', label: 'portion' },
];

const inputModeOptions = [
  { value: 'interne', label: 'Interne (Ciqual)' },
  { value: 'manuelle', label: 'Manuelle' },
  { value: 'openfoodfacts', label: 'OpenFoodFacts' },
];

const defaultFood: FoodInput = {
  name: '',
  quantity: 0,
  unit: 'g',
  calories: 0,
  proteins: 0,
  lipids: 0,
  carbs: 0,
  fibers: 0,
};

const emptyFood = {
  ...defaultFood,
  quantity: undefined,
  calories: undefined,
  proteins: undefined,
  lipids: undefined,
  carbs: undefined,
  fibers: undefined,
} as unknown as FoodInput;

function toISODate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function toDateInputValue(dateStr: string | undefined): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calculateConsumed(perHundred: number, quantity: number): number {
  return Math.round(perHundred * quantity / 100 * 10) / 10;
}

function calculatePerHundred(consumed: number, quantity: number): number {
  if (quantity <= 0) return consumed;
  return Math.round(consumed * 100 / quantity * 10) / 10;
}

export function NutritionForm({ initialData, onSubmit, onCancel, loading = false }: NutritionFormProps) {
  const [searchModalIndex, setSearchModalIndex] = useState<number | null>(null);
  const [savedFlags, setSavedFlags] = useState<boolean[]>(() => {
    const initialFoods = initialData?.foods ?? [{ ...defaultFood }];
    return initialFoods.map((food) => isFoodSaved(food.name));
  });
  const [foodStates, setFoodStates] = useState<FoodFieldState[]>(() => {
    const initialFoods = initialData?.foods ?? [{ ...defaultFood }];
    return initialFoods.map((food) => {
      const qty = food.quantity || 100;
      const perHundredValues = {
        calories: calculatePerHundred(food.calories || 0, qty),
        proteins: calculatePerHundred(food.proteins || 0, qty),
        lipids: calculatePerHundred(food.lipids || 0, qty),
        carbs: calculatePerHundred(food.carbs || 0, qty),
        fibers: calculatePerHundred(food.fibers || 0, qty),
      };
      const hasValues = perHundredValues.calories > 0 || perHundredValues.proteins > 0;
      return {
        inputMode: 'manuelle' as InputMode,
        perHundred: hasValues ? perHundredValues : null,
      };
    });
  });

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<SchemaInput>({
    resolver: zodResolver(nutritionEntryFormSchema),
    defaultValues: {
      date: toDateInputValue(initialData?.date),
      mealType: initialData?.mealType ?? 'breakfast',
      foods: initialData?.foods?.length
        ? initialData.foods.map((food) => {
          const qty = food.quantity || 100;
          return {
            ...food,
            calories: calculatePerHundred(food.calories || 0, qty),
            proteins: calculatePerHundred(food.proteins || 0, qty),
            lipids: calculatePerHundred(food.lipids || 0, qty),
            carbs: calculatePerHundred(food.carbs || 0, qty),
            fibers: calculatePerHundred(food.fibers || 0, qty),
          };
        })
        : [{ ...emptyFood }],
      totalCalories: initialData?.totalCalories ?? 0,
      totalProteins: initialData?.totalProteins ?? 0,
      totalLipids: initialData?.totalLipids ?? 0,
      totalCarbs: initialData?.totalCarbs ?? 0,
      totalFibers: initialData?.totalFibers ?? 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'foods',
    rules: { required: true },
  });

  const watchedFoods = watch('foods');

  const [totals, setTotals] = useState(() => {
    const initialFoods = initialData?.foods ?? [{ ...defaultFood }];
    let totalCalories = 0;
    let totalProteins = 0;
    let totalLipids = 0;
    let totalCarbs = 0;
    let totalFibers = 0;

    for (let i = 0; i < initialFoods.length; i++) {
      const food = initialFoods[i];
      totalCalories += food.calories || 0;
      totalProteins += food.proteins || 0;
      totalLipids += food.lipids || 0;
      totalCarbs += food.carbs || 0;
      totalFibers += food.fibers || 0;
    }

    return {
      calories: Math.round(totalCalories * 10) / 10,
      proteins: Math.round(totalProteins * 10) / 10,
      lipids: Math.round(totalLipids * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fibers: Math.round(totalFibers * 10) / 10,
    };
  });

  const updateTotals = useCallback(() => {
    const currentFoods = getValues('foods');
    let totalCalories = 0;
    let totalProteins = 0;
    let totalLipids = 0;
    let totalCarbs = 0;
    let totalFibers = 0;

    for (let i = 0; i < currentFoods.length; i++) {
      const food = currentFoods[i];
      const state = foodStates[i];
      const qty = food.quantity || 0;

      if (state?.perHundred) {
        totalCalories += calculateConsumed(state.perHundred.calories, qty);
        totalProteins += calculateConsumed(state.perHundred.proteins, qty);
        totalLipids += calculateConsumed(state.perHundred.lipids, qty);
        totalCarbs += calculateConsumed(state.perHundred.carbs, qty);
        totalFibers += calculateConsumed(state.perHundred.fibers, qty);
      } else {
        totalCalories += calculateConsumed(food.calories || 0, qty);
        totalProteins += calculateConsumed(food.proteins || 0, qty);
        totalLipids += calculateConsumed(food.lipids || 0, qty);
        totalCarbs += calculateConsumed(food.carbs || 0, qty);
        totalFibers += calculateConsumed(food.fibers || 0, qty);
      }
    }

    const computed = {
      calories: Math.round(totalCalories * 10) / 10,
      proteins: Math.round(totalProteins * 10) / 10,
      lipids: Math.round(totalLipids * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fibers: Math.round(totalFibers * 10) / 10,
    };

    setTotals(computed);
    setValue('totalCalories', computed.calories, { shouldValidate: true });
    setValue('totalProteins', computed.proteins, { shouldValidate: true });
    setValue('totalLipids', computed.lipids, { shouldValidate: true });
    setValue('totalCarbs', computed.carbs, { shouldValidate: true });
    setValue('totalFibers', computed.fibers, { shouldValidate: true });
  }, [foodStates, setValue, getValues]);

  const handleFoodSelect = useCallback(
    (food: CiqualFoodParsed) => {
      if (searchModalIndex === null) return;
      setValue(`foods.${searchModalIndex}.name`, food.nom);
      setValue(`foods.${searchModalIndex}.unit`, 'g');
      setValue(`foods.${searchModalIndex}.quantity`, 100);
      setValue(`foods.${searchModalIndex}.calories`, food.energie);
      setValue(`foods.${searchModalIndex}.proteins`, food.proteines);
      setValue(`foods.${searchModalIndex}.lipids`, food.lipides);
      setValue(`foods.${searchModalIndex}.carbs`, food.glucides);
      setValue(`foods.${searchModalIndex}.fibers`, food.fibres);
      setFoodStates((prev) => {
        const updated = [...prev];
        updated[searchModalIndex] = {
          inputMode: 'interne',
          perHundred: {
            calories: food.energie,
            proteins: food.proteines,
            lipids: food.lipides,
            carbs: food.glucides,
            fibers: food.fibres,
          },
        };
        return updated;
      });
    },
    [searchModalIndex, setValue]
  );

  const handleInputModeChange = useCallback(
    (index: number, mode: InputMode) => {
      setFoodStates((prev) => {
        const updated = [...prev];
        updated[index] = { inputMode: mode, perHundred: null };
        return updated;
      });
      if (mode === 'manuelle') {
        setValue(`foods.${index}.unit`, 'g');
      }
    },
    [setValue]
  );

  const handleFormSubmit = (data: SchemaInput) => {
    const foodsWithConsumed = data.foods.map((food, index) => {
      const state = foodStates[index];
      const qty = food.quantity || 0;

      if (state?.perHundred) {
        return {
          ...food,
          calories: calculateConsumed(state.perHundred.calories, qty),
          proteins: calculateConsumed(state.perHundred.proteins, qty),
          lipids: calculateConsumed(state.perHundred.lipids, qty),
          carbs: calculateConsumed(state.perHundred.carbs, qty),
          fibers: calculateConsumed(state.perHundred.fibers, qty),
        };
      }

      return {
        ...food,
        calories: calculateConsumed(food.calories || 0, qty),
        proteins: calculateConsumed(food.proteins || 0, qty),
        lipids: calculateConsumed(food.lipids || 0, qty),
        carbs: calculateConsumed(food.carbs || 0, qty),
        fibers: calculateConsumed(food.fibers || 0, qty),
      };
    });

    const computedTotals = {
      totalCalories: foodsWithConsumed.reduce((s, f) => s + f.calories, 0),
      totalProteins: foodsWithConsumed.reduce((s, f) => s + f.proteins, 0),
      totalLipids: foodsWithConsumed.reduce((s, f) => s + f.lipids, 0),
      totalCarbs: foodsWithConsumed.reduce((s, f) => s + f.carbs, 0),
      totalFibers: foodsWithConsumed.reduce((s, f) => s + f.fibers, 0),
    };

    onSubmit({
      date: toISODate(data.date),
      mealType: data.mealType,
      foods: foodsWithConsumed,
      totalCalories: Math.round(computedTotals.totalCalories * 10) / 10,
      totalProteins: Math.round(computedTotals.totalProteins * 10) / 10,
      totalLipids: Math.round(computedTotals.totalLipids * 10) / 10,
      totalCarbs: Math.round(computedTotals.totalCarbs * 10) / 10,
      totalFibers: Math.round(computedTotals.totalFibers * 10) / 10,
    });
  };

  const handleAddFood = () => {
    append({ ...emptyFood });
    setFoodStates((prev) => [...prev, { inputMode: 'manuelle', perHundred: null }]);
  };

  const handleBarcodeSearch = useCallback(
    async (index: number) => {
      const barcode = getValues(`foods.${index}.barcode`);
      if (!barcode || !barcode.trim()) return;

      try {
        const product = await getProductByBarcode(barcode.trim());
        if (product) {
          setValue(`foods.${index}.name`, product.name);
          setValue(`foods.${index}.unit`, product.unit);
          setValue(`foods.${index}.quantity`, product.quantity);
          setValue(`foods.${index}.calories`, product.calories);
          setValue(`foods.${index}.proteins`, product.proteins);
          setValue(`foods.${index}.lipids`, product.lipids);
          setValue(`foods.${index}.carbs`, product.carbs);
          setValue(`foods.${index}.fibers`, product.fibers);
          setFoodStates((prev) => {
            const updated = [...prev];
            updated[index] = {
              inputMode: 'openfoodfacts',
              perHundred: {
                calories: product.calories,
                proteins: product.proteins,
                lipids: product.lipids,
                carbs: product.carbs,
                fibers: product.fibers,
              },
            };
            return updated;
          });
        }
      } catch {
        // Ignorer les erreurs de recherche par code-barres
      }
    },
    [setValue, getValues]
  );

  const handleRemoveFood = (index: number) => {
    remove(index);
    setFoodStates((prev) => prev.filter((_, i) => i !== index));
  };

  const foodErrors = errors.foods as Record<string, Record<string, string>> | undefined;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Date"
          type="date"
          error={errors.date?.message}
          {...register('date')}
        />

        <Select
          label="Type de repas"
          options={mealTypeOptions}
          placeholder="Sélectionner le type de repas"
          error={errors.mealType?.message}
          {...register('mealType')}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Aliments</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddFood}
          >
            + Ajouter un aliment
          </Button>
        </div>

        {fields.map((field, index) => {
          const fieldErrors = foodErrors?.[index] as Record<string, string> | undefined;
          const foodState = foodStates[index];
          const food = watchedFoods?.[index];
          const inputMode = foodState?.inputMode ?? 'manuelle';
          const hasPerHundred = foodState?.perHundred !== null;
          const quantity = food?.quantity || 0;
          const isInterne = inputMode === 'interne';
          const isOpenFoodFacts = inputMode === 'openfoodfacts';
          const showSearchButton = isInterne && !hasPerHundred;
          const isLocked = hasPerHundred && (isInterne || isOpenFoodFacts);

          const perHundred = foodState?.perHundred;

          const consumedCalories = perHundred
            ? calculateConsumed(perHundred.calories, quantity)
            : calculateConsumed(food?.calories || 0, quantity);
          const consumedProteins = perHundred
            ? calculateConsumed(perHundred.proteins, quantity)
            : calculateConsumed(food?.proteins || 0, quantity);
          const consumedLipids = perHundred
            ? calculateConsumed(perHundred.lipids, quantity)
            : calculateConsumed(food?.lipids || 0, quantity);
          const consumedCarbs = perHundred
            ? calculateConsumed(perHundred.carbs, quantity)
            : calculateConsumed(food?.carbs || 0, quantity);
          const consumedFibers = perHundred
            ? calculateConsumed(perHundred.fibers, quantity)
            : calculateConsumed(food?.fibers || 0, quantity);

          return (
            <div key={field.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Aliment #{index + 1}</span>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemoveFood(index)}
                  >
                    Retirer
                  </Button>
                )}
              </div>

              <Select
                label="Mode de saisie"
                options={inputModeOptions}
                value={inputMode}
                onChange={(e) => handleInputModeChange(index, e.target.value as InputMode)}
              />

              <div className="relative mb-3">
                {inputMode === 'manuelle' ? (
                  <div>
                    <div className="flex items-end gap-2 mb-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Nom
                        </label>
                        <input
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          placeholder="Saisir le nom"
                          {...register(`foods.${index}.name`, {
                            onChange: (e) => {
                              const name = e.target.value;
                              const savedFoods = getSavedFoods();
                              const found = savedFoods.find(
                                (sf) => sf.name.toLowerCase() === name.toLowerCase()
                              );
                              if (found) {
                                setValue(`foods.${index}.unit`, found.unit);
                                setValue(`foods.${index}.quantity`, found.quantity);
                                setValue(`foods.${index}.calories`, found.calories);
                                setValue(`foods.${index}.proteins`, found.proteins);
                                setValue(`foods.${index}.lipids`, found.lipids);
                                setValue(`foods.${index}.carbs`, found.carbs);
                                setValue(`foods.${index}.fibers`, found.fibers);
                                setSavedFlags((prev) => {
                                  const updated = [...prev];
                                  updated[index] = true;
                                  return updated;
                                });
                              }
                            },
                          })}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap pb-1">
                        <input
                          type="checkbox"
                          checked={savedFlags[index] ?? false}
                          onChange={() => {
                            const food = getValues(`foods.${index}`);
                            const isCurrentlySaved = savedFlags[index];
                            if (isCurrentlySaved) {
                              removeSavedFood(food.name);
                            } else {
                              saveFood({
                                name: food.name,
                                unit: food.unit,
                                quantity: food.quantity,
                                calories: food.calories,
                                proteins: food.proteins,
                                lipids: food.lipids,
                                carbs: food.carbs,
                                fibers: food.fibers,
                              });
                            }
                            setSavedFlags((prev) => {
                              const updated = [...prev];
                              updated[index] = !isCurrentlySaved;
                              return updated;
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                        />
                        Mémoriser
                      </label>
                    </div>
                    {getSavedFoods().length > 0 && (
                      <select
                        title="Aliments mémorisés"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        defaultValue=""
                        onChange={(e) => {
                          const name = e.target.value;
                          if (!name) return;
                          const savedFoods = getSavedFoods();
                          const found = savedFoods.find(
                            (sf) => sf.name.toLowerCase() === name.toLowerCase()
                          );
                          if (found) {
                            setValue(`foods.${index}.name`, found.name);
                            setValue(`foods.${index}.unit`, found.unit);
                            setValue(`foods.${index}.quantity`, found.quantity);
                            setValue(`foods.${index}.calories`, found.calories);
                            setValue(`foods.${index}.proteins`, found.proteins);
                            setValue(`foods.${index}.lipids`, found.lipids);
                            setValue(`foods.${index}.carbs`, found.carbs);
                            setValue(`foods.${index}.fibers`, found.fibers);
                            setSavedFlags((prev) => {
                              const updated = [...prev];
                              updated[index] = true;
                              return updated;
                            });
                          }
                          e.target.value = '';
                        }}
                      >
                        <option value="">Aliments mémorisés...</option>
                        {getSavedFoods().map((sf) => (
                          <option key={sf.name} value={sf.name}>
                            {sf.name} ({sf.calories} kcal/100{sf.unit})
                          </option>
                        ))}
                      </select>
                    )}
                    {fieldErrors?.name && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>
                    )}
                  </div>
                ) : isInterne ? (
                  <div className="relative">
                    <Input
                      label="Nom"
                      error={fieldErrors?.name}
                      {...register(`foods.${index}.name`)}
                      disabled={isInterne}
                    />
                    <button
                      type="button"
                      onClick={() => setSearchModalIndex(index)}
                      className="absolute right-2 top-7 rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-colors"
                      title="Rechercher dans la table Ciqual"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                ) : null}
                {showSearchButton && inputMode !== 'interne' && (
                  <button
                    type="button"
                    onClick={() => setSearchModalIndex(index)}
                    className="absolute right-2 top-7 rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-colors"
                    title="Rechercher dans la table Ciqual"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                )}
              </div>

              {isOpenFoodFacts && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Code-barres
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await startBarcodeScan(
                            (barcode) => {
                              setValue(`foods.${index}.barcode`, barcode);
                              handleBarcodeSearch(index);
                            },
                            (error) => {
                              alert(`Erreur de scan : ${error}`);
                            }
                          );
                        } catch {
                          const input = document.querySelector<HTMLInputElement>(`[name="foods.${index}.barcode"]`);
                          input?.focus();
                        }
                      }}
                      className="flex-shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                      title="Scanner un code-barres"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </button>
                    <div className="flex-1 relative">
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        placeholder="Saisir le code-barres"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        {...register(`foods.${index}.barcode`)}
                      />
                      <button
                        type="button"
                        onClick={() => handleBarcodeSearch(index)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-colors"
                        title="Rechercher par code-barres"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {fieldErrors?.barcode && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.barcode}</p>
                  )}
                </div>
              )}

              {isOpenFoodFacts && (
                <div className="mb-3">
                  <Input
                    label="Nom"
                    error={fieldErrors?.name}
                    {...register(`foods.${index}.name`)}
                    disabled={isOpenFoodFacts}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Quantité"
                    type="number"
                    step="0.01"
                    min="0"
                    error={fieldErrors?.quantity}
                    {...register(`foods.${index}.quantity`, { setValueAs: (value) => value === '' ? undefined : Number(value) })}
                    onBlur={updateTotals}
                  />
                  <Select
                    label="Unité"
                    options={unitOptions}
                    error={fieldErrors?.unit}
                    {...register(`foods.${index}.unit`)}
                    disabled={isLocked}
                  />
                </div>

                <div className="col-span-full">
                  <div className="grid grid-cols-3 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    <div>Nutriment</div>
                    <div className="text-center">Pour 100{food?.unit === 'ml' ? 'ml' : 'g'}</div>
                    <div className="text-center">Consommé</div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <label className="text-sm text-slate-700 dark:text-slate-300">Calories</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        error={fieldErrors?.calories}
                        {...register(`foods.${index}.calories`, { setValueAs: (value) => value === '' ? undefined : Number(value) })}
                        disabled={isLocked}
                        className="text-center"
                        onBlur={updateTotals}
                      />
                      <div className="text-center text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2">
                        {consumedCalories} kcal
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center">
                      <label className="text-sm text-slate-700 dark:text-slate-300">Protéines</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        error={fieldErrors?.proteins}
                        {...register(`foods.${index}.proteins`, { setValueAs: (value) => value === '' ? undefined : Number(value) })}
                        disabled={isLocked}
                        className="text-center"
                        onBlur={updateTotals}
                      />
                      <div className="text-center text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2">
                        {consumedProteins} g
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center">
                      <label className="text-sm text-slate-700 dark:text-slate-300">Lipides</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        error={fieldErrors?.lipids}
                        {...register(`foods.${index}.lipids`, { setValueAs: (value) => value === '' ? undefined : Number(value) })}
                        disabled={isLocked}
                        className="text-center"
                        onBlur={updateTotals}
                      />
                      <div className="text-center text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2">
                        {consumedLipids} g
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center">
                      <label className="text-sm text-slate-700 dark:text-slate-300">Glucides</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        error={fieldErrors?.carbs}
                        {...register(`foods.${index}.carbs`, { setValueAs: (value) => value === '' ? undefined : Number(value) })}
                        disabled={isLocked}
                        className="text-center"
                        onBlur={updateTotals}
                      />
                      <div className="text-center text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2">
                        {consumedCarbs} g
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center">
                      <label className="text-sm text-slate-700 dark:text-slate-300">Fibres</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        error={fieldErrors?.fibers}
                        {...register(`foods.${index}.fibers`, { setValueAs: (value) => value === '' ? undefined : Number(value) })}
                        disabled={isLocked}
                        className="text-center"
                        onBlur={updateTotals}
                      />
                      <div className="text-center text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2">
                        {consumedFibers} g
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {typeof errors.foods?.message === 'string' && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.foods.message}</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Totaux (consommés)</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totals.calories}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">kcal</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totals.proteins}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">protéines (g)</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totals.lipids}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">lipides (g)</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totals.carbs}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">glucides (g)</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totals.fibers}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">fibres (g)</p>
          </div>
        </div>
      </div>

      <input type="hidden" {...register('totalCalories', { valueAsNumber: true })} />
      <input type="hidden" {...register('totalProteins', { valueAsNumber: true })} />
      <input type="hidden" {...register('totalLipids', { valueAsNumber: true })} />
      <input type="hidden" {...register('totalCarbs', { valueAsNumber: true })} />
      <input type="hidden" {...register('totalFibers', { valueAsNumber: true })} />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Annuler
        </Button>
        <Button type="submit" loading={loading} onClick={updateTotals}>
          {initialData ? 'Mettre à jour' : 'Créer'}
        </Button>
      </div>

      <FoodSearchModal
        isOpen={searchModalIndex !== null}
        onClose={() => setSearchModalIndex(null)}
        onSelect={handleFoodSelect}
        initialSearch={searchModalIndex !== null ? watchedFoods?.[searchModalIndex]?.name : undefined}
      />
    </form>
  );
}
