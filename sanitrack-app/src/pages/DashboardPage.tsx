import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useSettingsStore } from '@/stores/settings-store';
import { useVisibilityStore } from '@/stores/visibility-store';

interface MenuItem {
  title: string;
  path: string;
  icon: string;
  description: string;
}

const menuItems: MenuItem[] = [
  {
    title: 'Analyse sanguine',
    path: '/blood-analysis',
    icon: '🔬',
    description: 'Cholestérol, glucose, triglycérides…',
  },
  {
    title: 'Activité physique',
    path: '/physical-activity',
    icon: '🏃',
    description: 'Distance, durée, calories, rythme cardiaque…',
  },
  {
    title: 'Poids / IMC',
    path: '/weight-bmi',
    icon: '⚖️',
    description: 'Masse, taille, indice de masse corporelle…',
  },
  {
    title: 'Sommeil',
    path: '/sleep',
    icon: '😴',
    description: 'Durée, sommeil profond, léger, paradoxal…',
  },
  {
    title: 'Pression artérielle',
    path: '/blood-pressure',
    icon: '💓',
    description: 'Systolique, diastolique…',
  },
  {
    title: 'Nutrition',
    path: '/nutrition',
    icon: '🥗',
    description: 'Calories, protéines, lipides, glucides…',
  },
  {
    title: 'Pollens',
    path: '/pollens',
    icon: '🌿',
    description: 'Suivi des allergènes polliniques…',
  },
  {
    title: 'Exporter un rapport',
    path: '/export',
    icon: '📄',
    description: 'Choisissez les rubriques et la période, puis téléchargez votre rapport PDF.',
  },
];

const slogans = [
  "Tes données, ton corps, ton choix — pas le business plan de quelqu'un d'autre.",
  "SaniTrack : la seule appli santé qui ne connaît pas ton médecin traitant… ni ton assureur.",
  "On garde tes données chez toi, comme ton estomac garde une raclette : bien au chaud et personne y touche.",
  "Les autres applis vendent ton sommeil. Nous, on te laisse ronfler tranquille.",
  "SaniTrack : parce qu'un carnet de santé ne devrait pas être une carte de fidélité.",
  "Tes données de santé : les nôtres restent chez toi, les leurs finissent chez des inconnus. Devine qui est le sage ?",
  "Avec SaniTrack, tes données sont aussi privées que ton historique de navigation en mode incognito.",
  "On pourrait vendre tes données, mais on préfère te regarder dans les yeux (enfin, virtuellement).",
  "SaniTrack : on traque ta santé comme un détective privé, mais on garde tout dans ton navigateur — pas dans le cloud d'un assureur.",
  "On exporte tes données partout, sauf sur le compte en banque d'un actionnaire.",
];

function DashboardPage() {
  const slogan = useMemo(() => slogans[Math.floor(Math.random() * slogans.length)], []);
  const atmoLogin = useSettingsStore((s) => s.atmoLogin);
  const atmoPassword = useSettingsStore((s) => s.atmoPassword);
  const hasAtmoCredentials = Boolean(atmoLogin && atmoPassword);
  const hiddenCategories = useVisibilityStore((s) => s.hiddenCategories);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Menu</h1>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-900/30">
        <p className="text-lg font-semibold text-indigo-800 dark:text-indigo-300">
          🩺 {slogan}
        </p>
        <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
          Pendant que les autres applis revendent ton sommeil, ton rythme cardiaque et ta liste de courses à des assureurs, SaniTrack garde tout chez toi. Pas de serveur, pas de revente, pas de "on partage vos données pour améliorer votre expérience" (traduction : on se fait de l'argent sur votre dos). Exporte tes stats et va les montrer à ton médecin — ou à ton coach, on est pas regardants. On est votre carnet de santé, pas votre espion de poche. 🕵️‍♂️
        </p>
      </div>

      <nav className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
        {menuItems
          .filter((item) => !hiddenCategories[item.path])
          .map((item) => {
          const isPollen = item.path === '/pollens';
          const disabled = isPollen && !hasAtmoCredentials;

          return (
              <div key={item.path} className="h-full">
              <Link
                to={disabled ? '#' : item.path}
                onClick={disabled ? (e) => e.preventDefault() : undefined}
                className={clsx(
                  'flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-all dark:bg-slate-800 h-full',
                  disabled
                    ? 'cursor-not-allowed border-slate-200 opacity-50 dark:border-slate-700'
                    : 'border-slate-200 hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:hover:border-indigo-600',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <h2 className={clsx(
                    'font-semibold',
                    disabled
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400',
                  )}>
                    {item.title}
                  </h2>
                </div>
                <p className={clsx(
                  'mt-2 flex-1 text-sm',
                  disabled
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'text-slate-500 dark:text-slate-400',
                )}>
                  {disabled ? 'Aulne, Bouleau, Cupressacées…' : item.description}
                </p>
                <div className="mt-3 flex justify-end">
                  <svg className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export { DashboardPage };
