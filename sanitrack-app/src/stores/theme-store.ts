import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
}

interface ThemeActions {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export type ThemeStore = ThemeState & { actions: ThemeActions };

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'light',

  actions: {
    setTheme: (theme: Theme) => {
      set({ theme });
      applyTheme(theme);
    },

    toggleTheme: () => {
      const current = get().theme;
      const next = current === 'light' ? 'dark' : 'light';
      set({ theme: next });
      applyTheme(next);
    },

    initializeTheme: () => {
      const theme = getStoredTheme();
      set({ theme });
      applyTheme(theme);
    },
  },
}));