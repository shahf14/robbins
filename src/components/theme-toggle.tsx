'use client';

import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type AppTheme,
} from '@/lib/theme';

function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  const saved = readStoredTheme();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveTheme(saved, prefersDark);
}

export function ThemeToggle({compact = false}: {compact?: boolean}) {
  const t = useTranslations();
  const [theme, setTheme] = useState<AppTheme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function selectTheme(nextTheme: AppTheme) {
    if (nextTheme === theme) return;
    persistTheme(nextTheme);
    setTheme(nextTheme);
  }

  const options: AppTheme[] = ['light', 'dark'];

  if (compact) {
    return (
      <div
        className="inline-flex items-center rounded-full border border-white/12 bg-white/4 p-1"
        role="group"
        aria-label={t('theme.toggle')}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => selectTheme(option)}
            aria-pressed={theme === option}
            className={`focus-ring rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] transition-all duration-200 ${
              theme === option
                ? 'bg-[var(--blue)] text-white shadow-sm'
                : 'text-white/55 hover:text-white'
            }`}
          >
            {t(`theme.${option}`)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <span className="field-label mb-0 text-sm font-bold text-[var(--muted)]">{t('settings.themeTitle')}</span>
      <div
        className="inline-flex items-center self-start rounded-2xl border border-[color:var(--color-border-strong)] fill-2 p-1"
        role="group"
        aria-label={t('theme.toggle')}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => selectTheme(option)}
            aria-pressed={theme === option}
            className={`focus-ring rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200 ${
              theme === option
                ? 'bg-[var(--blue)] text-white shadow-sm'
                : 'txt-soft hover:txt-strong'
            }`}
          >
            {t(`theme.${option}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
