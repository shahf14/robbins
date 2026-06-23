'use client';

import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {
  formatAdminActivityTime,
  getAdminActivity,
  type AdminActivityKey,
  type AdminActivityState,
} from '@/lib/admin/admin-activity';
import {getStoredAdminApiToken, getStoredLocalAuthToken} from '@/components/admin-db/use-db-api';
import type {AppLocale} from '@/i18n/config';

export type AdminShellTab = 'content' | 'logs' | 'settings' | 'database';

type RiskTone = 'safe' | 'medium' | 'high';

const RISK_CLASS: Record<RiskTone, string> = {
  safe: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  medium: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  high: 'border-red-400/30 bg-red-400/10 text-red-100',
};

const OVERVIEW_TABS: AdminShellTab[] = ['content', 'database', 'logs', 'settings'];

export function AdminRiskBadge({tab}: {tab: AdminShellTab}) {
  const t = useTranslations('admin.shell.risk');
  const tone: RiskTone =
    tab === 'database'
      ? 'high'
      : tab === 'content'
        ? 'medium'
        : 'safe';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RISK_CLASS[tone]}`}>
      {t(`${tab}.label`)}
    </span>
  );
}

export function AdminOverviewCard({
  activeTab,
  onSelectTab,
}: {
  activeTab: AdminShellTab;
  onSelectTab: (tab: AdminShellTab) => void;
}) {
  const t = useTranslations('admin.shell.overview');

  return (
    <div className="rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/6 p-5 sm:p-6">
      <h2 className="text-lg font-black txt-strong">{t('title')}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {OVERVIEW_TABS.map((key) => (
          <button
            key={key}
            type="button"
            className={`focus-ring rounded-2xl border p-4 text-start transition ${
              activeTab === key
                ? 'border-white/30 bg-white/10'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
            }`}
            onClick={() => onSelectTab(key)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black txt-strong">{t(`actions.${key}.title`)}</span>
              <AdminRiskBadge tab={key} />
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t(`actions.${key}.hint`)}</p>
            <p className="mt-2 text-xs font-semibold text-white/45">{t(`actions.${key}.access`)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminSetupChecklist({
  onGoToTab,
  activityVersion,
}: {
  onGoToTab: (tab: AdminShellTab) => void;
  activityVersion: number;
}) {
  const t = useTranslations('admin.shell.setup');
  const [hasLocal, setHasLocal] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [activity, setActivity] = useState<AdminActivityState>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setHasLocal(Boolean(getStoredLocalAuthToken().trim()));
      setHasAdmin(Boolean(getStoredAdminApiToken().trim()));
      setActivity(getAdminActivity());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activityVersion]);

  const dbOk = Boolean(activity.dbConnectionOk);
  const allDone = hasLocal && hasAdmin && dbOk;

  if (allDone) return null;

  const steps = [
    {done: hasLocal, label: t('steps.localToken'), tab: 'database' as const},
    {done: hasAdmin, label: t('steps.adminToken'), tab: 'database' as const},
    {done: dbOk, label: t('steps.dbConnection'), tab: 'database' as const},
  ];

  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/8 p-5">
      <h2 className="text-base font-black text-amber-100">{t('title')}</h2>
      <p className="mt-1 text-sm leading-6 text-amber-100/75">{t('subtitle')}</p>
      <ol className="mt-4 grid gap-2">
        {steps.map((step, index) => (
          <li key={step.label} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                step.done ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-white/50'
              }`}
              aria-hidden
            >
              {step.done ? '✓' : index + 1}
            </span>
            <span className={`flex-1 text-sm ${step.done ? 'text-white/55 line-through' : 'txt-strong'}`}>
              {step.label}
            </span>
            {!step.done ? (
              <button type="button" className="focus-ring btn-admin-view text-xs" onClick={() => onGoToTab(step.tab)}>
                {t('go')}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AdminActivityBar({locale, activityVersion}: {locale: AppLocale; activityVersion: number}) {
  const t = useTranslations('admin.shell.activity');
  const never = t('never');
  const [activity, setActivity] = useState<AdminActivityState>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setActivity(getAdminActivity()), 0);
    return () => window.clearTimeout(timeoutId);
  }, [activityVersion]);

  const items: Array<{key: AdminActivityKey; label: string}> = [
    {key: 'dbSync', label: t('dbSync')},
    {key: 'export', label: t('export')},
    {key: 'settingsSave', label: t('settingsSave')},
  ];

  const hasAny = items.some((item) => activity[item.key]);
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-[var(--muted)]">
      {items.map((item) => (
        <span key={item.key}>
          <span className="font-semibold text-white/55">{item.label}:</span>{' '}
          {formatAdminActivityTime(activity[item.key], locale, never)}
        </span>
      ))}
    </div>
  );
}

export function AdminTabChrome({
  tab,
  subCrumb,
  onOpenHelp,
}: {
  tab: AdminShellTab;
  subCrumb?: string | null;
  onOpenHelp: () => void;
}) {
  const t = useTranslations('admin.shell');
  const tabLabel = t(`tabs.${tab}`);
  const segments = [t('breadcrumbRoot'), tabLabel, ...(subCrumb ? [subCrumb] : [])];

  return (
    <div className="mb-5 grid gap-2 border-b border-[color:var(--color-border)] pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {segments.map((segment, index) => (
            <span key={`${segment}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span className="txt-faint" aria-hidden>/</span> : null}
              <span className={index === segments.length - 1 ? 'txt-soft' : 'text-[var(--blue)]'}>{segment}</span>
            </span>
          ))}
        </nav>
        <button type="button" className="focus-ring btn-admin-view h-9 w-9 rounded-full p-0" onClick={onOpenHelp} aria-label={t('help.open')}>
          ?
        </button>
      </div>
      <p className="text-sm leading-6 text-[var(--muted)]">{t(`tabHint.${tab}`)}</p>
    </div>
  );
}

export function AdminHelpDrawer({
  tab,
  open,
  onClose,
}: {
  tab: AdminShellTab;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('admin.shell.help');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label={t('close')} onClick={onClose} />
      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col border-s border-white/10 bg-[var(--color-surface-elevated)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-help-title"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id="admin-help-title" className="text-lg font-black txt-strong">
            {t(`${tab}.title`)}
          </h2>
          <button type="button" className="focus-ring btn-admin-view" onClick={onClose}>
            {t('close')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <HelpSection title={t('sections.what')} body={t(`${tab}.what`)} />
          <HelpSection title={t('sections.when')} body={t(`${tab}.when`)} />
          <HelpSection title={t('sections.avoid')} body={t(`${tab}.avoid`)} />
          <HelpSection title={t('sections.buttons')} body={t(`${tab}.buttons`)} />
        </div>
      </aside>
    </div>
  );
}

function HelpSection({title, body}: {title: string; body: string}) {
  return (
    <section className="mb-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p>
    </section>
  );
}

export function AdminEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:text-start">
      <h3 className="text-base font-black txt-strong">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="focus-ring btn-admin-view mt-4" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function AdminViewButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`focus-ring btn-admin-view ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AdminActionButton({
  children,
  className = '',
  destructive,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {destructive?: boolean}) {
  return (
    <button
      type={type}
      className={`focus-ring ${destructive ? 'btn-admin-action-danger' : 'btn-admin-action'} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminButtonLegend() {
  const t = useTranslations('admin.shell.buttons');
  return (
    <p className="text-xs text-[var(--muted)]">
      <span className="font-semibold text-white/55">{t('view')}:</span> {t('viewHint')} ·{' '}
      <span className="font-semibold text-white/55">{t('action')}:</span> {t('actionHint')}
    </p>
  );
}
