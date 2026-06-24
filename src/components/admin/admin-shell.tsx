'use client';

import {useTranslations} from 'next-intl';
import {useEffect, useState, type ButtonHTMLAttributes, type ReactNode} from 'react';
import {
  formatAdminActivityTime,
  getAdminActivity,
  getLatestAdminActivity,
  type AdminActivityKey,
  type AdminActivityState,
} from '@/lib/admin/admin-activity';
import {dbApi, getStoredAdminApiToken, getStoredLocalAuthToken} from '@/components/admin-db/use-db-api';
import {AdminHoverTip} from '@/components/admin/admin-tooltip';
import {DEFAULT_AFFIRMATIONS} from '@/lib/default-affirmations';
import {loadDomainDefaultGoals} from '@/lib/domain-default-goals';
import {isAffirmationVisibleInRitual, mergeAffirmationLibrary} from '@/lib/morning-ritual/affirmation-library';
import {fetchRitualContent} from '@/lib/morning-ritual-storage';
import type {AppLocale} from '@/i18n/config';

export type AdminShellTab = 'content' | 'identities' | 'logs' | 'settings' | 'database';

export type AdminContentSection = 'domain-goals' | 'affirmations' | 'goalless-tasks';

const MAIN_TABS: AdminShellTab[] = ['content', 'identities', 'database', 'logs', 'settings'];

const CONTENT_SECTIONS: AdminContentSection[] = ['domain-goals', 'affirmations', 'goalless-tasks'];

const TAB_ICONS: Record<AdminShellTab, string> = {
  content: '◈',
  identities: '◎',
  database: '▦',
  logs: '≣',
  settings: '⚙',
};

const RISK_CLASS: Record<RiskTone, string> = {
  safe: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  medium: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  high: 'border-red-400/30 bg-red-400/10 text-red-100',
};

type RiskTone = 'safe' | 'medium' | 'high';

export function AdminRiskBadge({tab}: {tab: AdminShellTab}) {
  const t = useTranslations('admin.shell.risk');
  const tone: RiskTone =
    tab === 'database'
      ? 'high'
      : tab === 'content' || tab === 'identities'
        ? 'medium'
        : 'safe';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RISK_CLASS[tone]}`}>
      {t(`${tab}.label`)}
    </span>
  );
}

export type BreadcrumbSegment = {
  label: string;
  onClick?: () => void;
};

export function AdminMetaItem({label, value}: {label: string; value: ReactNode}) {
  return (
    <span className="admin-meta-item">
      <span className="admin-meta-item__label">{label}:</span>{' '}
      <span className="admin-meta-item__value">{value}</span>
    </span>
  );
}

export function AdminWelcomeDashboard({
  locale,
  activityVersion,
  onGoToTab,
  onGoToContentSection,
}: {
  locale: AppLocale;
  activityVersion: number;
  onGoToTab: (tab: AdminShellTab) => void;
  onGoToContentSection: (section: AdminContentSection) => void;
}) {
  const t = useTranslations('admin.shell.dashboard');
  const never = t('noActivity');
  const [activeAffirmations, setActiveAffirmations] = useState<number | null>(null);
  const [publishedGoals, setPublishedGoals] = useState<number | null>(null);
  const [activity, setActivity] = useState<AdminActivityState>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setActivity(getAdminActivity());
      void fetchRitualContent()
        .then(({affirmations}) => {
          const merged = mergeAffirmationLibrary(affirmations, DEFAULT_AFFIRMATIONS);
          setActiveAffirmations(merged.filter(isAffirmationVisibleInRitual).length);
        })
        .catch(() => setActiveAffirmations(0));
      try {
        const goals = loadDomainDefaultGoals();
        setPublishedGoals(goals.filter((goal) => goal.status === 'published').length);
      } catch {
        setPublishedGoals(0);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activityVersion]);

  const latest = getLatestAdminActivity(activity);
  const lastActionLabel = latest ? t(`lastActions.${latest.key}`) : never;
  const lastActionTime = latest
    ? formatAdminActivityTime(latest.at, locale, never)
    : null;

  return (
    <div className="admin-dashboard rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">{t('eyebrow')}</p>
          <h2 className="mt-1 text-lg font-black txt-strong">{t('title')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        <p className="text-xs text-amber-200/75">{t('securityNote')}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="admin-dashboard__stat rounded-xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/45">{t('activeAffirmations')}</p>
          <p className="mt-2 text-3xl font-black txt-strong">
            {activeAffirmations === null ? '—' : activeAffirmations}
          </p>
        </div>
        <div className="admin-dashboard__stat rounded-xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/45">{t('publishedGoals')}</p>
          <p className="mt-2 text-3xl font-black txt-strong">
            {publishedGoals === null ? '—' : publishedGoals}
          </p>
        </div>
        <div className="admin-dashboard__stat rounded-xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/45">{t('lastAction')}</p>
          <p className="mt-2 text-sm font-bold txt-strong">{lastActionLabel}</p>
          {lastActionTime ? <p className="mt-1 text-xs text-[var(--muted)]">{lastActionTime}</p> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <p className="w-full text-xs font-bold uppercase tracking-[0.1em] text-white/45">{t('quickActions')}</p>
        <button
          type="button"
          className="focus-ring btn-admin-view text-sm"
          onClick={() => {
            onGoToTab('content');
            onGoToContentSection('affirmations');
          }}
        >
          {t('actionAffirmations')}
        </button>
        <button
          type="button"
          className="focus-ring btn-admin-view text-sm"
          onClick={() => {
            onGoToTab('content');
            onGoToContentSection('domain-goals');
          }}
        >
          {t('actionGoals')}
        </button>
        <button
          type="button"
          className="focus-ring btn-admin-view text-sm"
          onClick={() => {
            onGoToTab('content');
            onGoToContentSection('goalless-tasks');
          }}
        >
          {t('actionGoallessTasks')}
        </button>
        <button type="button" className="focus-ring btn-admin-view text-sm" onClick={() => onGoToTab('identities')}>
          {t('actionIdentities')}
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({
  tab,
  contentSection,
  onSelectTab,
  onSelectContentSection,
}: {
  tab: AdminShellTab;
  contentSection: AdminContentSection;
  onSelectTab: (tab: AdminShellTab) => void;
  onSelectContentSection: (section: AdminContentSection) => void;
}) {
  const t = useTranslations('admin');

  return (
    <nav className="admin-shell__sidebar" aria-label={t('shell.nav.main')}>
      <p className="admin-shell__nav-label">{t('shell.nav.main')}</p>
      <ul className="admin-shell__nav-list">
        {MAIN_TABS.map((key) => {
          const active = tab === key;
          return (
            <li key={key}>
              <button
                type="button"
                className={`admin-shell__nav-item ${active ? 'admin-shell__nav-item--active' : ''} ${
                  key === 'database' ? 'admin-shell__nav-item--danger' : ''
                }`}
                onClick={() => onSelectTab(key)}
              >
                <AdminHoverTip
                  tip={t(`shell.tabHint.${key}`)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="admin-shell__nav-icon" aria-hidden>
                      {TAB_ICONS[key]}
                    </span>
                    <span className="truncate">{t(`tabs.${key}`)}</span>
                  </span>
                  <AdminRiskBadge tab={key} />
                </AdminHoverTip>
              </button>
            </li>
          );
        })}
      </ul>

      {tab === 'content' ? (
        <div className="admin-shell__subnav">
          <p className="admin-shell__nav-label">{t('shell.nav.contentTools')}</p>
          <ul className="admin-shell__nav-list">
            {CONTENT_SECTIONS.map((section) => (
              <li key={section}>
                <button
                  type="button"
                  className={`admin-shell__nav-item admin-shell__nav-item--sub ${
                    contentSection === section ? 'admin-shell__nav-item--active' : ''
                  }`}
                  onClick={() => onSelectContentSection(section)}
                  title={t(`shell.sectionHint.${section}`)}
                >
                  {t(`content.sections.${section}`)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

export function AdminBreadcrumbBar({
  segments,
  hint,
  onOpenHelp,
}: {
  segments: BreadcrumbSegment[];
  hint: string;
  onOpenHelp: () => void;
}) {
  const t = useTranslations('admin.shell');

  return (
    <div className="admin-shell__breadcrumb">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            return (
              <span key={`${segment.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 ? <span className="txt-faint" aria-hidden>/</span> : null}
                {segment.onClick && !isLast ? (
                  <button
                    type="button"
                    className="focus-ring rounded-md text-[var(--blue)] hover:underline"
                    onClick={segment.onClick}
                  >
                    {segment.label}
                  </button>
                ) : (
                  <span className={isLast ? 'txt-soft' : 'text-[var(--blue)]'}>{segment.label}</span>
                )}
              </span>
            );
          })}
        </nav>
        <button
          type="button"
          className="focus-ring btn-admin-view h-9 w-9 shrink-0 rounded-full p-0"
          onClick={onOpenHelp}
          aria-label={t('help.open')}
        >
          ?
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export function AdminSetupChecklist({
  onGoToTab,
  activityVersion,
  adminSessionReady = false,
}: {
  onGoToTab: (tab: AdminShellTab) => void;
  activityVersion: number;
  adminSessionReady?: boolean;
}) {
  const t = useTranslations('admin.shell.setup');
  const [hasLocal, setHasLocal] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [hasAdminSession, setHasAdminSession] = useState(false);
  const [activity, setActivity] = useState<AdminActivityState>({});
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setHasLocal(Boolean(getStoredLocalAuthToken().trim()));
      setHasAdmin(Boolean(getStoredAdminApiToken().trim()));
      setHasAdminSession(adminSessionReady);
      void dbApi.getAdminSession()
        .then((status) => setHasAdminSession(status.active))
        .catch(() => {});
      setActivity(getAdminActivity());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activityVersion, adminSessionReady]);

  const dbOk = Boolean(activity.dbConnectionOk);
  const adminAccessOk = hasAdmin || hasAdminSession || adminSessionReady;
  const localOk = hasLocal || adminSessionReady;
  const allDone = localOk && adminAccessOk && dbOk;

  useEffect(() => {
    if (allDone) {
      setExpanded(false);
    } else {
      setExpanded(true);
    }
  }, [allDone]);

  const steps = [
    {done: hasLocal, label: t('steps.localToken'), tab: 'database' as const},
    {done: adminAccessOk, label: t('steps.adminToken'), tab: 'database' as const},
    {done: dbOk, label: t('steps.dbConnection'), tab: 'database' as const},
  ];

  if (allDone) {
    return (
      <div className="admin-setup admin-setup--done">
        <button
          type="button"
          className="admin-setup__toggle focus-ring"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="admin-setup__badge">{t('configuredBadge')}</span>
          <span className="admin-setup__title">{t('title')}</span>
          <span className="admin-setup__chevron" aria-hidden>
            {expanded ? '▴' : '▾'}
          </span>
        </button>
        {expanded ? (
          <ol className="admin-setup__list mt-3 grid gap-2">
            {steps.map((step) => (
              <li key={step.label} className="admin-setup__step admin-setup__step--done flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-xs font-black text-emerald-100" aria-hidden>
                  ✓
                </span>
                <span className="flex-1 text-sm text-white/55 line-through">{step.label}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }

  return (
    <div className="admin-setup admin-setup--pending rounded-2xl border border-amber-400/25 bg-amber-400/8 p-5">
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
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`focus-ring btn-admin-view ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AdminCreateButton({
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`focus-ring btn-admin-create ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AdminPrimaryButton({
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`focus-ring btn-admin-primary ${className}`} {...props}>
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
}: ButtonHTMLAttributes<HTMLButtonElement> & {destructive?: boolean}) {
  return (
    <button
      type={type}
      className={`focus-ring ${destructive ? 'btn-admin-action-danger' : 'btn-admin-primary'} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminDestructiveButton({
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`focus-ring btn-admin-action-danger ${className}`} {...props}>
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
