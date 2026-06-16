'use client';

import {useLocale, useTranslations} from 'next-intl';
import {type FormEvent, useEffect, useRef, useState} from 'react';
import type {AppLocale} from '@/i18n/config';
import type {AffirmationItem, AffirmationType, IdentityOption} from '@/lib/morning-ritual-types';
import {DEFAULT_AFFIRMATIONS} from '@/lib/default-affirmations';
import {
  fetchRitualContent,
  saveAffirmations,
  saveIdentities,
} from '@/lib/morning-ritual-storage';
import {loadUserPreferences, saveUserPreferences} from '@/lib/user-preferences';
import {AffirmationManager} from './affirmation-manager';
import {LanguageSwitcher} from './language-switcher';

import {DatabaseTab} from './admin-db/database-tab';
import {dateToYMD} from '@/lib/date-utils';

type AdminTab = 'content' | 'logs' | 'settings' | 'database';

export function AdminPanel() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [tab, setTab] = useState<AdminTab>('content');

  const tabs: {key: AdminTab; label: string}[] = [
    {key: 'content', label: t('admin.tabs.content')},
    {key: 'logs', label: t('admin.tabs.logs')},
    {key: 'settings', label: t('admin.tabs.settings')},
    {key: 'database', label: 'Database'},
  ];

  return (
    <section className="panel-surface p-6 sm:p-8">
      {/* Admin notice banner #26/#27 */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/6 px-4 py-3">
        <p className="text-sm font-semibold text-amber-200/80">{t('admin.securityNotice')}</p>
      </div>
      <div>
        <p className="eyebrow text-white/55">{t('admin.title')}</p>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">{t('admin.pageTitle')}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">{t('admin.subtitle')}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === item.key
                ? 'bg-white/12 text-white'
                : 'text-white/55 hover:text-white'
            }`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'content' && <ContentTab locale={locale} />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'database' && <DatabaseTab />}
      </div>
    </section>
  );
}

function ContentTab({locale}: {locale: AppLocale}) {
  const t = useTranslations();

  const [affirmations, setAffirmations] = useState<AffirmationItem[]>([]);
  const [identities, setIdentities] = useState<IdentityOption[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<AffirmationType>('text');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newIdentity, setNewIdentity] = useState('');

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      void fetchRitualContent().then(({affirmations: saved, identities}) => {
        if (cancelled) return;
        setAffirmations(saved.length > 0 ? saved : DEFAULT_AFFIRMATIONS);
        setIdentities(identities);
      }).catch(() => {});
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  function addAffirmation() {
    const item: AffirmationItem = {
      id: crypto.randomUUID(),
      type: newType,
      title: newTitle.trim(),
      textContent: newType === 'text' ? newContent.trim() : '',
      youtubeVideoId: null,
      youtubeUrl: newType === 'youtube' ? newYoutubeUrl.trim() : null,
      tags: newTags
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      language: locale,
      active: true,
      weight: 1,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...affirmations];
    setAffirmations(next);
    saveAffirmations(next.filter((affirmation) => !affirmation.isDefault));
    setNewTitle('');
    setNewContent('');
    setNewYoutubeUrl('');
    setNewTags('');
    setShowAddForm(false);
  }

  function deleteAffirmation(id: string) {
    const next = affirmations.filter((a) => a.id !== id);
    setAffirmations(next);
    saveAffirmations(next.filter((affirmation) => !affirmation.isDefault));
  }

  function addIdentity(e: FormEvent) {
    e.preventDefault();
    if (!newIdentity.trim()) return;
    const item: IdentityOption = {
      id: crypto.randomUUID(),
      text: newIdentity.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...identities];
    setIdentities(next);
    saveIdentities(next);
    setNewIdentity('');
  }

  function deleteIdentity(id: string) {
    const next = identities.filter((i) => i.id !== id);
    setIdentities(next);
    saveIdentities(next);
  }

  return (
    <div className="grid gap-8">
      <div>
        <h3 className="text-lg font-bold">{t('admin.content.affirmationsTitle')}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('admin.content.affirmationsDescription')}</p>
        <div className="mt-4">
          <AffirmationManager
            affirmations={affirmations}
            showAddForm={showAddForm}
            newType={newType}
            newTitle={newTitle}
            newContent={newContent}
            newYoutubeUrl={newYoutubeUrl}
            newTags={newTags}
            onShowAddForm={setShowAddForm}
            onNewTypeChange={setNewType}
            onNewTitleChange={setNewTitle}
            onNewContentChange={setNewContent}
            onNewYoutubeUrlChange={setNewYoutubeUrl}
            onNewTagsChange={setNewTags}
            onAdd={addAffirmation}
            onDelete={deleteAffirmation}
            onClose={() => {}}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold">{t('admin.content.identitiesTitle')}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('admin.content.identitiesDescription')}</p>

        <form className="mt-4 flex gap-2" onSubmit={addIdentity}>
          <input
            className="focus-ring input-base flex-1"
            value={newIdentity}
            placeholder={t('admin.content.identityPlaceholder')}
            onChange={(e) => setNewIdentity(e.target.value)}
          />
          <button
            className="focus-ring btn-primary shrink-0 disabled:opacity-60"
            type="submit"
            disabled={!newIdentity.trim()}
          >
            {t('admin.content.addIdentity')}
          </button>
        </form>

        <div className="mt-3 grid gap-2">
          {identities.length === 0 && (
            <p className="text-sm text-[var(--muted)]">{t('admin.content.noIdentities')}</p>
          )}
          {identities.map((identity) => (
            <div key={identity.id} className="panel-surface flex items-center justify-between gap-3 p-3">
              <p className="min-w-0 truncate text-sm">{identity.text}</p>
              <button
                className="focus-ring btn-small shrink-0"
                type="button"
                onClick={() => deleteIdentity(identity.id)}
              >
                {t('admin.content.deleteIdentity')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type LogEntry = {
  timestamp?: string;
  type?: string;
  message?: string;
  raw?: string;
};

function LogsTab() {
  const t = useTranslations();
  const [date, setDate] = useState(() => dateToYMD(new Date()));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs(date);
  }, [date]);

  async function fetchLogs(dateStr: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?date=${dateStr}&limit=200`);
      const data = (await res.json()) as {lines: LogEntry[]};
      setLogs(data.lines ?? []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }

  return (
    <div>
      <h3 className="text-lg font-bold">{t('admin.logs.title')}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('admin.logs.description')}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="focus-ring input-base"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          className="focus-ring btn-secondary"
          type="button"
          onClick={() => fetchLogs(date)}
        >
          {t('admin.logs.refresh')}
        </button>
        <span className="text-sm text-[var(--muted)]">
          {t('admin.logs.count', {count: logs.length})}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {loading && <p className="text-sm text-[var(--muted)]">Loading...</p>}
        {!loading && logs.length === 0 && (
          <p className="text-sm text-[var(--muted)]">{t('admin.logs.noLogs')}</p>
        )}
        {logs.map((entry, i) => (
          <div key={`log-${i}`} className="panel-surface p-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              {entry.timestamp && <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>}
              {entry.type && (
                <span className="rounded bg-white/8 px-2 py-0.5 font-mono">{entry.type}</span>
              )}
            </div>
            <p className="mt-1 text-sm">{entry.message ?? entry.raw ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const t = useTranslations();
  const displayNameRef = useRef<HTMLInputElement>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const saveResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (displayNameRef.current) {
      displayNameRef.current.value = loadUserPreferences().display_name;
    }
    return () => {
      if (saveResetTimeoutRef.current) {
        window.clearTimeout(saveResetTimeoutRef.current);
      }
    };
  }, []);

  function handleSave(e?: FormEvent) {
    e?.preventDefault();
    saveUserPreferences({display_name: displayNameRef.current?.value ?? ''});
    setSaveState('saved');
    if (saveResetTimeoutRef.current) {
      window.clearTimeout(saveResetTimeoutRef.current);
    }
    saveResetTimeoutRef.current = window.setTimeout(() => {
      setSaveState('idle');
      saveResetTimeoutRef.current = null;
    }, 1800);
  }

  return (
    <div>
      <h3 className="text-lg font-bold">{t('admin.settings.title')}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('admin.settings.description')}</p>

      <form className="mt-6 grid max-w-md gap-5" onSubmit={handleSave}>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('settings.displayName')}</span>
          <input
            ref={displayNameRef}
            className="focus-ring input-base"
            maxLength={60}
            placeholder={t('settings.displayNamePlaceholder')}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button className="focus-ring btn-primary" type="submit">
            {t('settings.save')}
          </button>
          <span className="text-sm font-semibold text-[var(--blue)]">
            {saveState === 'saved' ? t('settings.saved') : t('settings.localOnly')}
          </span>
        </div>
      </form>

      <div className="mt-8">
        <p className="field-label mb-0 text-white/50">{t('settings.languageTitle')}</p>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t('settings.languageHelp')}</p>
        <div className="mt-4">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
