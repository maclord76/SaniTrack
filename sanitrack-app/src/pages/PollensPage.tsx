import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@/components/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/db/database';
import type { PollenAllergenScore } from '@/models/types';
import { useSettingsStore } from '@/stores/settings-store';
import {
  fetchPollenIndices,
  getPollenCategoryInfo,
  getPollenIndiceImage,
  getOverallPollenLevel,
  type PollenResponse,
  type PollenTaxon,
  type PollenDayData,
} from '@/services/pollen-api';

const clampAllergenScore = (score: number) => Math.max(0, Math.min(5, score));
interface PollenSensitivityDraft {
  name: string;
  score: string;
  toleratedThreshold: string;
  reactiveThreshold: string;
}

const emptyPollenProfile = (taxon: string, name: string, now: string): PollenAllergenScore => ({
  taxon,
  name,
  score: 0,
  toleratedThreshold: null,
  reactiveThreshold: null,
  lastConcentration: null,
  lastFeedback: null,
  observations: 0,
  toleratedCount: 0,
  reactiveCount: 0,
  createdAt: now,
  updatedAt: now,
});

function formatDisplayDate(value?: string | null): string {
  if (!value) return 'Non renseignee';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDisplayDateTime(value?: string | null): string {
  if (!value) return 'Non renseignee';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatConcentration(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Non renseignee';
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatConcentrationWithUnit(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Non renseignee';
  return `${formatConcentration(value)} grains/m3`;
}

function getPersonalSensitivityLabel(profile?: PollenAllergenScore, concentration?: number | null): string {
  if (!profile) return 'Seuil a apprendre';
  if (
    profile.reactiveThreshold !== null &&
    profile.reactiveThreshold !== undefined &&
    concentration !== null &&
    concentration !== undefined &&
    concentration >= profile.reactiveThreshold
  ) {
    return `Risque perso des ${formatConcentration(profile.reactiveThreshold)} grains/m3`;
  }
  if (profile.reactiveThreshold !== null && profile.reactiveThreshold !== undefined) {
    return `Seuil reaction ${formatConcentration(profile.reactiveThreshold)} grains/m3`;
  }
  if (profile.toleratedThreshold !== null && profile.toleratedThreshold !== undefined) {
    return `Tolere jusqu'a ${formatConcentration(profile.toleratedThreshold)} grains/m3`;
  }
  return 'Seuil a apprendre';
}

function PollensPage() {
  const navigate = useNavigate();
  const atmoLogin = useSettingsStore((s) => s.atmoLogin);
  const atmoPassword = useSettingsStore((s) => s.atmoPassword);
  const atmoLocation = useSettingsStore((s) => s.atmoLocation);

  const [data, setData] = useState<PollenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likeStatus, setLikeStatus] = useState<'like' | 'dislike' | null>(null);
  const [allergenProfiles, setAllergenProfiles] = useState<Record<string, PollenAllergenScore>>({});
  const [editingProfile, setEditingProfile] = useState<PollenAllergenScore | null>(null);
  const [profileDraft, setProfileDraft] = useState<PollenSensitivityDraft>({
    name: '',
    score: '0',
    toleratedThreshold: '',
    reactiveThreshold: '',
  });
  const [deleteConfirmTaxon, setDeleteConfirmTaxon] = useState<string | null>(null);
  const [profileFormError, setProfileFormError] = useState<string | null>(null);

  const hasCredentials = Boolean(atmoLogin && atmoPassword && atmoLocation);
  const pollenDays = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Aujourd'hui", day: data.today },
      { label: 'Demain', day: data.tomorrow },
      { label: 'Apres-demain', day: data.afterTomorrow },
    ].filter(
      (item): item is { label: string; day: PollenDayData } =>
        Boolean(item.day && (item.day.zone || item.day.pollen.length > 0)),
    );
  }, [data]);
  const hasAnyPollenData = pollenDays.some((item) => item.day.pollen.length > 0);
  const sensitivityRecords = useMemo(() => {
    return Object.values(allergenProfiles).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [allergenProfiles]);

  const loadAllergenScores = useCallback(async () => {
    const scores = await db.pollenAllergenScores.toArray();
    setAllergenProfiles(
      Object.fromEntries(scores.map((score) => [score.taxon, score])),
    );
  }, []);

  const loadData = useCallback(async () => {
    if (!atmoLogin || !atmoPassword || !atmoLocation) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPollenIndices(atmoLogin, atmoPassword, atmoLocation);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [atmoLogin, atmoPassword, atmoLocation]);

  useEffect(() => {
    if (hasCredentials) {
      loadData();
    }
  }, [hasCredentials, loadData]);

  useEffect(() => {
    loadAllergenScores();
  }, [loadAllergenScores]);

  const handleFeedback = useCallback(
    async (nextStatus: 'like' | 'dislike') => {
      const todayPollens = data?.today?.pollen ?? [];
      if (todayPollens.length === 0) return;

      const previousStatus = likeStatus;
      const resolvedStatus = previousStatus === nextStatus ? null : nextStatus;

      setLikeStatus(resolvedStatus);
      if (!resolvedStatus) return;

      const now = new Date().toISOString();
      const pollensWithConcentration = todayPollens.filter(
        (pollen) => pollen.concentration !== null && pollen.concentration !== undefined,
      );
      const maxLevel = Math.max(...pollensWithConcentration.map((pollen) => pollen.level), 0);
      const reactiveCandidates = pollensWithConcentration.filter(
        (pollen) => pollen.level === maxLevel && pollen.level > 0 && (pollen.concentration ?? 0) > 0,
      );
      const learnedPollens = resolvedStatus === 'like' ? pollensWithConcentration : reactiveCandidates;
      if (learnedPollens.length === 0) return;

      const updatedProfiles: Record<string, PollenAllergenScore> = {};

      try {
        await db.transaction('rw', db.pollenAllergenScores, async () => {
          await Promise.all(
            learnedPollens.map(async (pollen) => {
              const concentration = pollen.concentration ?? 0;
              const existing = await db.pollenAllergenScores.get(pollen.taxon);
              const profile = existing ?? emptyPollenProfile(pollen.taxon, pollen.name, now);
              const nextProfile: PollenAllergenScore = {
                ...profile,
                name: pollen.name,
                score: clampAllergenScore(profile.score + (resolvedStatus === 'dislike' ? 1 : -1)),
                toleratedThreshold:
                  resolvedStatus === 'like'
                    ? Math.max(profile.toleratedThreshold ?? 0, concentration)
                    : profile.toleratedThreshold ?? null,
                reactiveThreshold:
                  resolvedStatus === 'dislike'
                    ? profile.reactiveThreshold === null || profile.reactiveThreshold === undefined
                      ? concentration
                      : Math.min(profile.reactiveThreshold, concentration)
                    : profile.reactiveThreshold ?? null,
                lastConcentration: concentration,
                lastFeedback: resolvedStatus,
                observations: (profile.observations ?? 0) + 1,
                toleratedCount: (profile.toleratedCount ?? 0) + (resolvedStatus === 'like' ? 1 : 0),
                reactiveCount: (profile.reactiveCount ?? 0) + (resolvedStatus === 'dislike' ? 1 : 0),
                updatedAt: now,
              };
              updatedProfiles[pollen.taxon] = nextProfile;
              await db.pollenAllergenScores.put(nextProfile);
            }),
          );
        });
        setAllergenProfiles((current) => ({ ...current, ...updatedProfiles }));
      } catch {
        setLikeStatus(previousStatus);
        await loadAllergenScores();
      }
    },
    [data, likeStatus, loadAllergenScores],
  );

  const openEditProfile = useCallback((profile: PollenAllergenScore) => {
    setEditingProfile(profile);
    setProfileFormError(null);
    setProfileDraft({
      name: profile.name,
      score: String(profile.score ?? 0),
      toleratedThreshold:
        profile.toleratedThreshold !== null && profile.toleratedThreshold !== undefined
          ? String(profile.toleratedThreshold)
          : '',
      reactiveThreshold:
        profile.reactiveThreshold !== null && profile.reactiveThreshold !== undefined
          ? String(profile.reactiveThreshold)
          : '',
    });
  }, []);

  const closeEditProfile = useCallback(() => {
    setEditingProfile(null);
    setProfileFormError(null);
  }, []);

  const parseOptionalNumber = useCallback((value: string): number | null => {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error('Les seuils doivent etre des nombres positifs.');
    }
    return parsed;
  }, []);

  const handleUpdateProfile = useCallback(async () => {
    if (!editingProfile) return;
    setProfileFormError(null);

    try {
      const score = Number(profileDraft.score);
      if (!Number.isFinite(score)) {
        throw new Error('Le score doit etre un nombre.');
      }

      const updatedProfile: PollenAllergenScore = {
        ...editingProfile,
        name: profileDraft.name.trim() || editingProfile.name,
        score: clampAllergenScore(Math.round(score)),
        toleratedThreshold: parseOptionalNumber(profileDraft.toleratedThreshold),
        reactiveThreshold: parseOptionalNumber(profileDraft.reactiveThreshold),
        updatedAt: new Date().toISOString(),
      };

      await db.pollenAllergenScores.put(updatedProfile);
      setAllergenProfiles((current) => ({
        ...current,
        [updatedProfile.taxon]: updatedProfile,
      }));
      closeEditProfile();
    } catch (err) {
      setProfileFormError((err as Error).message);
    }
  }, [closeEditProfile, editingProfile, parseOptionalNumber, profileDraft]);

  const handleDeleteProfile = useCallback(async (taxon: string) => {
    await db.pollenAllergenScores.delete(taxon);
    setAllergenProfiles((current) => {
      const next = { ...current };
      delete next[taxon];
      return next;
    });
    setDeleteConfirmTaxon(null);
  }, []);

  if (!hasCredentials) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pollens</h1>
        <Card title="Indices polliniques" subtitle="Suivi des allergenes polliniques">
          <EmptyState
            icon={<span className="text-4xl">herb</span>}
            message="Configurez vos identifiants Atmo France"
            description="Renseignez votre login, mot de passe et commune (code INSEE) dans les Parametres pour afficher les indices polliniques."
          />
          <div className="mt-4 flex justify-center">
            <Button variant="primary" onClick={() => navigate('/settings')}>
              Aller aux Parametres
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pollens</h1>
        <Button variant="secondary" size="sm" onClick={loadData} loading={loading}>
          Actualiser
        </Button>
      </div>

      {/* Infos communes (ville + code INSEE) + carte Moi */}
      {(() => {
        const zone = data && data.today && data.today.zone;
        if (!zone) return null;
        const todayPollens = data?.today?.pollen ?? [];
        return (
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
            <Card title="Localisation" className="md:col-span-1">
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-slate-400">Ville</dt>
                  <dd className="text-slate-900 dark:text-slate-100">{zone.lib_zone}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-400">Code INSEE</dt>
                  <dd className="text-slate-900 dark:text-slate-100">{zone.code_zone}</dd>
                </div>
                {zone.source && (
                  <div>
                    <dt className="font-medium text-slate-400">Source</dt>
                    <dd className="text-slate-900 dark:text-slate-100">{zone.source}</dd>
                  </div>
                )}
                {zone.date_maj && (
                  <div>
                    <dt className="font-medium text-slate-400">Mise a jour</dt>
                    <dd className="text-slate-900 dark:text-slate-100">{formatDisplayDateTime(zone.date_maj)}</dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card title="Moi" className="md:col-span-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant={likeStatus === 'like' ? 'primary' : 'secondary'}
                    onClick={() => void handleFeedback('like')}
                    className="flex items-center gap-2"
                  >
                    <svg
                      className={`h-5 w-5 ${likeStatus === 'like' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
                      fill={likeStatus === 'like' ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                    </svg>
                    <span>Pouce en haut</span>
                  </Button>

                  <Button
                    variant={likeStatus === 'dislike' ? 'danger' : 'secondary'}
                    onClick={() => void handleFeedback('dislike')}
                    className="flex items-center gap-2"
                  >
                    <svg
                      className={`h-5 w-5 ${likeStatus === 'dislike' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
                      fill={likeStatus === 'dislike' ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h3a2 2 0 012 2v7a2 2 0 01-2 2h-3" />
                    </svg>
                    <span>Pouce en bas</span>
                  </Button>
                </div>

                {/* Scores de graines des allergènes */}
                {todayPollens.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {todayPollens.map((p) => {
                      const profile = allergenProfiles[p.taxon];
                      const shortName = p.name.split(' ')[0];
                      const sensitivityLabel = getPersonalSensitivityLabel(profile, p.concentration);
                      return (
                        <div key={p.taxon} className="flex min-h-[92px] flex-col items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-center dark:border-slate-700">
                          <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{shortName}</span>
                          <span className="text-[10px] text-slate-400">
                            {formatConcentration(p.concentration)} grains/m3
                          </span>
                          <span
                            className="text-[10px] font-medium leading-tight text-slate-600 dark:text-slate-300"
                            title={sensitivityLabel}
                          >
                            {sensitivityLabel}
                          </span>
                          {profile?.observations ? (
                            <span className="text-[10px] text-slate-400">{profile.observations} avis</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>
        );
      })()}

      {loading && !data && (
        <Card title="Indices polliniques" subtitle="Chargement des donnees...">
          <div className="flex items-center justify-center py-12 text-slate-400">
            <svg className="mr-3 h-6 w-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Recuperation des indices polliniques...</span>
          </div>
        </Card>
      )}

      {error && (
        <Card title="Indices polliniques" subtitle="Une erreur est survenue">
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
            <div className="flex justify-center">
              <Button variant="primary" onClick={loadData} loading={loading}>
                Reessayer
              </Button>
            </div>
          </div>
        </Card>
      )}

      {(() => {
        const d = data;
        if (loading || error || !d) return null;
        return (
          <>
            {pollenDays.map(({ label, day }) => (
              <PollenDayCard key={`${label}-${day.zone?.date_ech || day.zone?.date || 'empty'}`} label={label} day={day} />
            ))}
          </>
        );
      })()}

      {(() => {
        const d = data;
        if (loading || error || !d || hasAnyPollenData) return null;
        return (
          <Card title="Indices polliniques" subtitle="Aucune donnee">
            <EmptyState
              message="Aucune donnee pollinique disponible"
              description="L'API Atmo France n'a pas renvoye de donnees pour cette commune sur la periode J a J+2."
            />
          </Card>
        );
      })()}

      <Card title="Enregistrements">
        {sensitivityRecords.length === 0 ? (
          <EmptyState
            message="Aucun seuil de sensibilite memorise"
            description="Utilisez les boutons de ressenti pour apprendre progressivement vos seuils pollen personnels."
          />
        ) : (
          <>
          <div className="-mx-6 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="w-12 px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Modifier</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Allergene</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Seuil tolere</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Seuil reaction</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Derniere valeur</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Avis</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Maj</th>
                  <th className="w-12 px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Supprimer</th>
                </tr>
              </thead>
              <tbody>
                {sensitivityRecords.map((record) => (
                  <tr key={record.taxon} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-center">
                      <Button variant="secondary" size="sm" onClick={() => openEditProfile(record)}>
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </Button>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-900 dark:text-slate-100">{record.name}</td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-200">
                      {formatConcentrationWithUnit(record.toleratedThreshold)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-200">
                      {formatConcentrationWithUnit(record.reactiveThreshold)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-200">
                      {formatConcentrationWithUnit(record.lastConcentration)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-200">
                      {record.observations ?? 0}
                      <span className="ml-1 text-xs text-slate-400">
                        ({record.toleratedCount ?? 0}+ / {record.reactiveCount ?? 0}-)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-200">
                      {formatDisplayDate(record.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="danger" size="sm" onClick={() => setDeleteConfirmTaxon(record.taxon)}>
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <Modal isOpen={editingProfile !== null} onClose={closeEditProfile} title="Modifier le seuil pollen">
        {profileFormError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{profileFormError}</p>
          </div>
        )}
        <div className="space-y-4">
          <Input
            label="Allergene"
            value={profileDraft.name}
            onChange={(e) => setProfileDraft((draft) => ({ ...draft, name: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Score"
              type="number"
              min="0"
              max="5"
              step="1"
              value={profileDraft.score}
              onChange={(e) => setProfileDraft((draft) => ({ ...draft, score: e.target.value }))}
            />
            <Input
              label="Seuil tolere"
              type="number"
              min="0"
              step="0.1"
              value={profileDraft.toleratedThreshold}
              onChange={(e) => setProfileDraft((draft) => ({ ...draft, toleratedThreshold: e.target.value }))}
            />
            <Input
              label="Seuil reaction"
              type="number"
              min="0"
              step="0.1"
              value={profileDraft.reactiveThreshold}
              onChange={(e) => setProfileDraft((draft) => ({ ...draft, reactiveThreshold: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeEditProfile}>Annuler</Button>
            <Button onClick={() => void handleUpdateProfile()}>Mettre a jour</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteConfirmTaxon !== null} onClose={() => setDeleteConfirmTaxon(null)} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Etes-vous sur de vouloir supprimer cet enregistrement de sensibilite pollen ? Cette action est irreversible.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmTaxon(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteConfirmTaxon && void handleDeleteProfile(deleteConfirmTaxon)}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
interface PollenDayCardProps {
  label: string;
  day: PollenDayData;
}

function PollenDayCard({ label, day }: PollenDayCardProps) {
  const pollens = day.pollen ?? [];
  const zone = day.zone;
  const overall = zone?.code_qual ?? getOverallPollenLevel(pollens);
  const overallInfo = getPollenCategoryInfo(overall);
  const overallLabel = zone?.lib_qual || overallInfo.label;
  const overallColor = zone?.coul_qual || overallInfo.color;
  const displayDate = formatDisplayDate(zone?.date_ech || zone?.date);
  const responsiblePollens = zone?.pollen_resp
    ? zone.pollen_resp
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .join(', ')
    : null;

  return (
    <Card title={`Indices polliniques - ${label}`} subtitle={zone ? `Date indice : ${displayDate}` : undefined}>
      <div className="space-y-5">
        {/* En-tete : indice global + date */}
        <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-700/40 lg:flex-row lg:items-center lg:gap-6">
          {overall > 0 ? (
            <img src={getPollenIndiceImage(overall)} alt={`Indice pollen ${overall}`} className="mx-auto h-24 w-24 shrink-0 lg:mx-0" />
          ) : (
            <div className="mx-auto flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-400 dark:bg-slate-600 lg:mx-0">
              <span className="text-xs font-medium">N/A</span>
            </div>
          )}
          <div className="min-w-0 flex-1 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Indice pollen global</p>
              {zone?.alerte && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                  Alerte pollen
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 lg:justify-start">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-white"
                style={{ backgroundColor: overallColor }}
              >
                Niveau {overall} - {overallLabel}
              </span>
            </div>
            {responsiblePollens && (
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                Responsable : {responsiblePollens}
              </p>
            )}
          </div>
        </div>

        {/* Liste detaillee des taxons : 6 allergenes sur une ligne (6 colonnes) */}
        {pollens.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {pollens.map((p) => (
              <PollenTaxonItem key={p.taxon} pollen={p} />
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-slate-400">
            Aucun taxon disponible pour cette journee.
          </p>
        )}
      </div>
    </Card>
  );
}
function PollenTaxonItem({ pollen }: { pollen: PollenTaxon }) {
  const info = getPollenCategoryInfo(pollen.level);
  // Nom court du taxon (ex: "Aulne (Alnus)" -> "Aulne")
  const shortName = pollen.name.split(' ')[0];
  const concentration = formatConcentration(pollen.concentration);
  const concentrationUnit = pollen.concentration_unit || 'grains/m3';

  return (
    <div className="flex min-h-[190px] flex-col items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-center dark:border-slate-700">
      {pollen.level > 0 ? (
        <img src={getPollenIndiceImage(pollen.level)} alt={`Indice ${pollen.level}`} className="h-12 w-12 shrink-0" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-400 dark:bg-slate-600">
          <span className="text-xs">N/A</span>
        </div>
      )}
      <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{shortName}</span>
      <span className="text-[10px] text-slate-400">Niv. {pollen.level}</span>
      <span
        className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-full px-1 py-0.5 text-[10px] font-semibold text-white"
        style={{ backgroundColor: info.color }}
      >
        {info.label}
      </span>
      <div className="mt-1 w-full rounded-md bg-slate-50 px-2 py-1 dark:bg-slate-700/50">
        <p className="text-[10px] font-medium text-slate-400">Concentration</p>
        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          {concentration} <span className="font-normal text-slate-400">{concentrationUnit}</span>
        </p>
      </div>
    </div>
  );
}

export default PollensPage;
