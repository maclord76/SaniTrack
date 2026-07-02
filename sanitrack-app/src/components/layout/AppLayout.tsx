import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { ThemeToggle } from '@/components/ui';
import { useThemeStore } from '@/stores/theme-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useVisibilityStore } from '@/stores/visibility-store';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Menu', path: '/', icon: '📋' },
  { label: 'Analyse sanguine', path: '/blood-analysis', icon: '🔬' },
  { label: 'Activité physique', path: '/physical-activity', icon: '🏃' },
  { label: 'Poids / IMC', path: '/weight-bmi', icon: '⚖️' },
  { label: 'Sommeil', path: '/sleep', icon: '😴' },
  { label: 'Pression artérielle', path: '/blood-pressure', icon: '💓' },
  { label: 'Nutrition', path: '/nutrition', icon: '🥗' },
  { label: 'Pollens', path: '/pollens', icon: '🌿' },
  { label: 'Paramètres', path: '/settings', icon: '⚙️' },
];

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initializeTheme = useThemeStore((s) => s.actions.initializeTheme);
  const atmoLogin = useSettingsStore((s) => s.atmoLogin);
  const atmoPassword = useSettingsStore((s) => s.atmoPassword);
  const hasAtmoCredentials = Boolean(atmoLogin && atmoPassword);
  const hiddenCategories = useVisibilityStore((s) => s.hiddenCategories);

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-700 dark:bg-slate-800 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6 dark:border-slate-700">
          <span className="text-2xl">🩺</span>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">SaniTrack</h1>
          <svg className="h-5 w-5" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="12" width="4" height="9" rx="1" fill="#3b82f6" stroke="#2563eb" />
            <rect x="10" y="7" width="4" height="14" rx="1" fill="#22c55e" stroke="#16a34a" />
            <rect x="17" y="3" width="4" height="18" rx="1" fill="#f59e0b" stroke="#d97706" />
          </svg>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems
              .filter((item) => !hiddenCategories[item.path])
              .map((item) => {
                const isPollen = item.path === '/pollens';
                const disabled = isPollen && !hasAtmoCredentials;

                return (
                  <li key={item.path}>
                    <NavLink
                      to={disabled ? '#' : item.path}
                      end={item.path === '/'}
                      onClick={(e) => {
                        if (disabled) e.preventDefault();
                        setSidebarOpen(false);
                      }}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          disabled
                            ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                            : isActive
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50',
                        )
                      }
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
          </ul>
        </nav>

        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Propulsé avec des IA par Maclord
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-800 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 lg:hidden"
            aria-label="Ouvrir le menu de navigation"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-xl">🩺</span>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">SaniTrack</h1>
            <svg className="h-4 w-4" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="12" width="4" height="9" rx="1" fill="#3b82f6" stroke="#2563eb" />
              <rect x="10" y="7" width="4" height="14" rx="1" fill="#22c55e" stroke="#16a34a" />
              <rect x="17" y="3" width="4" height="18" rx="1" fill="#f59e0b" stroke="#d97706" />
            </svg>
          </div>

          <div className="hidden lg:block" />

          <ThemeToggle persist={true} />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { AppLayout };