'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useEffect, useRef, useState} from 'react';
import {usePathname} from 'next/navigation';
import {Link} from '@/i18n/navigation';
import {fetchSessions, getStreak} from '@/lib/morning-ritual-storage';
import {
  loadUserPreferences,
  userPreferencesChangedEvent,
} from '@/lib/user-preferences';
import {LanguageSwitcher} from './language-switcher';
import {ThemeToggle} from './theme-toggle';

type RouteHref =
  | '/'
  | '/morning-priming'
  | '/evening-reset'
  | '/coach'
  | '/life-coach'
  | '/progress'
  | '/clarification'
  | '/settings'
  | '/admin'
  | '/start-here'
  | '/help'
  | '/privacy'
  | '/terms';

type RouteLink = {
  href: RouteHref;
  label: string;
};

type NavSection = {
  titleKey: 'nav.sectionPersonalCoach' | 'nav.sectionHelp' | 'nav.sectionLegal';
  items: RouteLink[];
};

function isActive(pathname: string, href: string, locale: string): boolean {
  const localizedHref = `/${locale}${href === '/' ? '' : href}`;
  if (href === '/') return pathname === `/${locale}` || pathname === `/${locale}/`;
  return pathname.startsWith(localizedHref);
}

function routinesActive(pathname: string, locale: string): boolean {
  return (
    isActive(pathname, '/morning-priming', locale) ||
    isActive(pathname, '/evening-reset', locale)
  );
}

async function readActivityStats() {
  try {
    const sessions = await fetchSessions();
    const completed = sessions.filter((session) => session.completed).length;
    return {streak: getStreak(sessions), ritualCount: completed};
  } catch {
    return {streak: 0, ritualCount: 0};
  }
}

export function AppHeader() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [streak, setStreak] = useState(0);
  const [ritualCount, setRitualCount] = useState(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPreferences = () => {
      setDisplayName(loadUserPreferences().display_name);
    };
    syncPreferences();
    window.addEventListener(userPreferencesChangedEvent, syncPreferences as EventListener);
    return () => window.removeEventListener(userPreferencesChangedEvent, syncPreferences as EventListener);
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      void readActivityStats().then((stats) => {
        setStreak(stats.streak);
        setRitualCount(stats.ritualCount);
      });
    }
  }, [isMenuOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsMenuOpen(false), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isMenuOpen) setIsMenuOpen(false);
        if (isMoreOpen) setIsMoreOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen, isMoreOpen]);

  useEffect(() => {
    if (!isMoreOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isMoreOpen]);

  const desktopPrimaryNav: RouteLink[] = [
    {href: '/start-here', label: t('nav.startHereShort')},
    {href: '/life-coach', label: t('nav.lifeCoachShort')},
    {href: '/progress', label: t('nav.progressShort')},
  ];

  const mobilePrimaryNav: RouteLink[] = [
    ...desktopPrimaryNav,
    {href: '/settings', label: t('nav.profileShort')},
  ];

  const overflowSections: NavSection[] = [
    {
      titleKey: 'nav.sectionPersonalCoach',
      items: [{href: '/clarification', label: t('nav.clarificationShort')}],
    },
    {
      titleKey: 'nav.sectionHelp',
      items: [
        {href: '/help', label: t('nav.help')},
        {href: '/admin', label: t('nav.adminShort')},
      ],
    },
    {
      titleKey: 'nav.sectionLegal',
      items: [
        {href: '/privacy', label: t('nav.privacy')},
        {href: '/terms', label: t('nav.terms')},
      ],
    },
  ];

  const openMenuLabel = locale === 'he' ? 'פתח ניווט' : 'Open navigation';
  const closeMenuLabel = locale === 'he' ? 'סגור ניווט' : 'Close navigation';
  const isOnboarding = pathname.includes('/onboarding');

  if (isOnboarding) {
    const promise =
      locale === 'he'
        ? 'עוד כמה דקות ויש לך מטרה, צעד ראשון, וסיבה ברורה לחזור מחר.'
        : 'A few minutes from now you will have a goal, a first step, and a clear reason to return tomorrow.';

    return (
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="page-shell flex h-[72px] items-center justify-between gap-4">
          <Link
            href="/"
            className="focus-ring flex shrink-0 items-center gap-2 font-[var(--font-display)] text-base font-extrabold uppercase tracking-[0.18em] text-white sm:text-lg"
            aria-label={t('app.fullName')}
          >
            <span>{t('app.nameShort')}</span>
          </Link>
          <p className="hidden max-w-xl text-center text-sm font-semibold leading-6 text-white/58 md:block">
            {promise}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle compact />
            <LanguageSwitcher compact />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="page-shell flex h-[72px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 lg:gap-5">
            <button
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-nav"
              aria-label={isMenuOpen ? closeMenuLabel : openMenuLabel}
              className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/4 text-white lg:hidden"
              onClick={() => setIsMenuOpen((prev) => !prev)}
            >
              <span className="flex w-5 flex-col gap-1.5" aria-hidden>
                <span className="h-0.5 rounded-full bg-current" />
                <span className="h-0.5 rounded-full bg-current" />
                <span className="h-0.5 rounded-full bg-current" />
              </span>
            </button>

            <Link
              href="/"
              className="focus-ring flex shrink-0 items-center gap-2 font-[var(--font-display)] text-base font-extrabold uppercase tracking-[0.18em] text-white sm:text-lg"
              aria-label={t('app.fullName')}
            >
              <span>{t('app.nameShort')}</span>
            </Link>

            <nav aria-label={t('nav.primary')} className="hidden items-center gap-0.5 text-[15px] font-medium lg:flex">
              <Link
                href="/start-here"
                className={`focus-ring rounded-full px-3.5 py-2 transition-all duration-200 ${
                  isActive(pathname, '/start-here', locale)
                    ? 'bg-[var(--blue)]/15 text-[var(--blue)] font-semibold'
                    : 'text-white/78 hover:bg-white/8 hover:text-white'
                }`}
                aria-current={isActive(pathname, '/start-here', locale) ? 'page' : undefined}
              >
                {t('nav.startHereShort')}
              </Link>

              <RoutinesNavMenu
                active={routinesActive(pathname, locale)}
                morningActive={isActive(pathname, '/morning-priming', locale)}
                eveningActive={isActive(pathname, '/evening-reset', locale)}
              />

              {desktopPrimaryNav.slice(1).map((item) => {
                const active = isActive(pathname, item.href, locale);
                const cls = `focus-ring rounded-full px-3.5 py-2 transition-all duration-200 ${
                  active ? 'bg-[var(--blue)]/15 text-[var(--blue)] font-semibold' : 'text-white/78 hover:bg-white/8 hover:text-white'
                }`;
                return (
                  <Link key={item.href} href={item.href} className={cls} aria-current={active ? 'page' : undefined}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <NavMoreMenu
              menuRef={moreMenuRef}
              open={isMoreOpen}
              onToggle={() => setIsMoreOpen((v) => !v)}
              onClose={() => setIsMoreOpen(false)}
              sections={overflowSections}
              pathname={pathname}
              locale={locale}
            />
            <HeaderProfileChip displayName={displayName} locale={locale} />
            <ThemeToggle compact />
            <LanguageSwitcher compact />
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 bg-black/65 transition ${
          isMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        } lg:hidden`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden
      />

      <aside
        id="mobile-nav"
        className={`fixed inset-y-0 start-0 z-[60] flex w-[min(22rem,88vw)] flex-col overflow-y-auto border-e border-white/10 bg-[#09090b] px-5 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.7)] transition-transform duration-300 lg:hidden ${
          isMenuOpen ? 'translate-x-0' : 'rtl:translate-x-full ltr:-translate-x-full'
        }`}
        aria-hidden={!isMenuOpen}
        aria-label={t('nav.primary')}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="font-[var(--font-display)] text-sm font-extrabold uppercase tracking-[0.18em] text-white">
            {t('app.nameShort')}
          </span>
          <button
            type="button"
            aria-label={closeMenuLabel}
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/4 text-xl leading-none text-white"
            onClick={() => setIsMenuOpen(false)}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/3 p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">{t('nav.streakLabel')}</p>
            <p className="mt-1 text-2xl font-black text-white">{streak > 0 ? streak : '—'}</p>
          </div>
          <div className="rounded-2xl bg-white/3 p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">{t('nav.checkInsLabel')}</p>
            <p className="mt-1 text-2xl font-black text-white">{ritualCount > 0 ? ritualCount : '—'}</p>
          </div>
        </div>

        <nav aria-label={t('nav.primary')} className="mt-5 grid gap-0.5">
          <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">{t('nav.sectionMain')}</p>
          {mobilePrimaryNav.map((item) => {
            const active = isActive(pathname, item.href, locale);
            const cls = `focus-ring flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition ${
              active ? 'bg-[var(--blue)]/15 text-[var(--blue)]' : 'text-white hover:bg-white/6'
            }`;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cls}
                aria-current={active ? 'page' : undefined}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="mt-2 px-2">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">{t('nav.routinesShort')}</p>
            <div className="grid grid-cols-2 gap-2">
              <RoutinesNavCard
                href="/morning-priming"
                label={t('nav.morningRoutine')}
                active={isActive(pathname, '/morning-priming', locale)}
                onNavigate={() => setIsMenuOpen(false)}
              />
              <RoutinesNavCard
                href="/evening-reset"
                label={t('nav.eveningRoutine')}
                active={isActive(pathname, '/evening-reset', locale)}
                onNavigate={() => setIsMenuOpen(false)}
              />
            </div>
          </div>
        </nav>

        {overflowSections.map((section) => (
          <nav key={section.titleKey} aria-label={t(section.titleKey)} className="mt-4 grid gap-0.5">
            <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
              {t(section.titleKey)}
            </p>
            {section.items.map((item) => {
              const active = isActive(pathname, item.href, locale);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`focus-ring flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/6 hover:text-white'
                  }`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ))}

        <div className="mt-auto grid gap-4 pt-6">
          <HeaderProfileChip displayName={displayName} locale={locale} />
          <ThemeToggle compact />
          <LanguageSwitcher compact />
        </div>
      </aside>
    </>
  );
}

function RoutinesNavMenu({
  active,
  morningActive,
  eveningActive,
}: {
  active: boolean;
  morningActive: boolean;
  eveningActive: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded="false"
        aria-label={t('nav.routinesMenuLabel')}
        className={`focus-ring flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[15px] font-medium transition-all duration-200 ${
          active
            ? 'bg-[var(--blue)]/15 text-[var(--blue)] font-semibold'
            : 'text-white/78 hover:bg-white/8 hover:text-white'
        }`}
      >
        {t('nav.routinesShort')}
        <span className="text-[10px] opacity-60 transition group-hover:opacity-100" aria-hidden="true">
          ▾
        </span>
      </button>

      <div className="pointer-events-none absolute top-full start-0 z-50 pt-2 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div
          role="menu"
          aria-label={t('nav.routinesMenuLabel')}
          className="grid min-w-[17rem] grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#0b0f14] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        >
          <RoutinesNavCard
            href="/morning-priming"
            label={t('nav.morningRoutine')}
            active={morningActive}
            compact
          />
          <RoutinesNavCard
            href="/evening-reset"
            label={t('nav.eveningRoutine')}
            active={eveningActive}
            compact
          />
        </div>
      </div>
    </div>
  );
}

function RoutinesNavCard({
  href,
  label,
  active,
  compact = false,
  onNavigate,
}: {
  href: '/morning-priming' | '/evening-reset';
  label: string;
  active: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const icon = href === '/morning-priming' ? '🌅' : '🌙';

  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`focus-ring flex min-h-[5.5rem] flex-col justify-between rounded-xl p-3 transition ${
        compact ? 'text-sm' : 'text-base'
      } ${
        active
          ? 'bg-[var(--blue)]/12 text-[var(--blue)]'
          : 'bg-white/4 text-white hover:bg-[var(--blue)]/8'
      }`}
    >
      <span className="text-lg leading-none" aria-hidden="true">
        {icon}
      </span>
      <span className="font-semibold leading-snug">{label}</span>
    </Link>
  );
}

function NavMoreMenu({
  menuRef,
  open,
  onToggle,
  onClose,
  sections,
  pathname,
  locale,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  sections: NavSection[];
  pathname: string;
  locale: string;
}) {
  const t = useTranslations();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="focus-ring rounded-full px-3 py-2 text-sm font-medium text-white/55 transition hover:bg-white/8 hover:text-white/85"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
      >
        {t('nav.moreMenuLabel')}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-2 min-w-[14rem] rounded-2xl border border-white/10 bg-[#0b0f14] py-2 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        >
          {sections.map((section, sectionIndex) => (
            <div key={section.titleKey}>
              {sectionIndex > 0 ? <div className="my-2 border-t border-white/8" aria-hidden /> : null}
              <p className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">
                {t(section.titleKey)}
              </p>
              {section.items.map((item) => {
                const active = isActive(pathname, item.href, locale);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className={`focus-ring block px-4 py-2.5 text-sm transition ${
                      active ? 'bg-white/6 font-semibold text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
                    }`}
                    onClick={onClose}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HeaderProfileChip({displayName, locale}: {displayName: string; locale: string}) {
  const t = useTranslations();
  const fallbackName = locale === 'he' ? 'המרחב שלי' : 'My space';
  const name = displayName || fallbackName;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const tooltip = locale === 'he' ? `פתח הגדרות — ${name}` : `Settings — ${name}`;

  return (
    <Link
      href="/settings"
      className="focus-ring group inline-flex w-full items-center gap-3 rounded-full bg-white/4 px-3 py-2 text-white transition hover:bg-white/8 lg:w-auto"
      aria-label={tooltip}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(26,109,255,0.18)] text-xs font-bold uppercase tracking-[0.12em] text-white transition group-hover:bg-[var(--blue)]/30">
        {initials || '—'}
      </span>
      <span className="truncate text-sm font-semibold text-white/82 group-hover:text-white">{name}</span>
    </Link>
  );
}
