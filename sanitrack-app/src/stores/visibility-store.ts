import { create } from 'zustand';

export interface CategoryVisibility {
  label: string;
  path: string;
  cookieKey: string;
  icon: string;
}

export const toggleableCategories: CategoryVisibility[] = [
  { label: 'Analyse sanguine', path: '/blood-analysis', cookieKey: 'hide_blood_analysis', icon: '🔬' },
  { label: 'Activité physique', path: '/physical-activity', cookieKey: 'hide_physical_activity', icon: '🏃' },
  { label: 'Poids / IMC', path: '/weight-bmi', cookieKey: 'hide_weight_bmi', icon: '⚖️' },
  { label: 'Sommeil', path: '/sleep', cookieKey: 'hide_sleep', icon: '😴' },
  { label: 'Pression artérielle', path: '/blood-pressure', cookieKey: 'hide_blood_pressure', icon: '💓' },
  { label: 'Nutrition', path: '/nutrition', cookieKey: 'hide_nutrition', icon: '🥗' },
  { label: 'Pollens', path: '/pollens', cookieKey: 'hide_pollens', icon: '🌿' },
];

function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

function setCookie(name: string, value: string, days = 365) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
}

interface VisibilityState {
  hiddenCategories: Record<string, boolean>;
  setCategoryHidden: (path: string, hidden: boolean) => void;
}

export const useVisibilityStore = create<VisibilityState>((set) => {
  const initialHidden: Record<string, boolean> = {};
  toggleableCategories.forEach((cat) => {
    const value = getCookie(cat.cookieKey);
    initialHidden[cat.path] = value === 'true';
  });

  return {
    hiddenCategories: initialHidden,
    setCategoryHidden: (path: string, hidden: boolean) => {
      const cat = toggleableCategories.find((c) => c.path === path);
      if (cat) {
        setCookie(cat.cookieKey, hidden ? 'true' : 'false');
        set((state) => ({
          hiddenCategories: {
            ...state.hiddenCategories,
            [path]: hidden,
          },
        }));
      }
    },
  };
});
