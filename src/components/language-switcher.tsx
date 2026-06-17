'use client';

import {useLocale, useTranslations} from 'next-intl';
import {locales, localeNames, type AppLocale} from '@/i18n/config';
import {saveUserPreferences} from '@/lib/user-preferences';

const storageKey = 'preferred_language';

function setLocaleCookie(locale: AppLocale) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

export function LanguageSwitcher({compact = false}: {compact?: boolean}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations();

  function changeLanguage(nextLocale: AppLocale) {
    if (nextLocale === locale) return;
    window.localStorage.setItem(storageKey, nextLocale);
    saveUserPreferences({preferred_language: nextLocale});
    setLocaleCookie(nextLocale);
    window.location.assign(`/${nextLocale}`);
  }

  if (compact) {
    return (
      <div
        className="inline-flex items-center rounded-full border border-white/12 bg-white/4 p-1"
        role="group"
        aria-label={t('language.label')}
      >
        {locales.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => changeLanguage(option)}
            aria-pressed={locale === option}
            className={`focus-ring rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] transition-all duration-200 ${
              locale === option
                ? 'bg-[var(--blue)] text-white shadow-sm'
                : 'text-white/55 hover:text-white'
            }`}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  // Full (settings page) variant
  return (
    <div className="grid gap-2">
      <span className="field-label mb-0 text-sm font-bold text-[var(--muted)]">{t('language.label')}</span>
      <div
        className="inline-flex items-center rounded-2xl border border-[color:var(--color-border-strong)] fill-2 p-1 self-start"
        role="group"
        aria-label={t('language.label')}
      >
        {locales.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => changeLanguage(option)}
            aria-pressed={locale === option}
            className={`focus-ring rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200 ${
              locale === option
                ? 'bg-[var(--blue)] text-white shadow-sm'
                : 'txt-soft hover:txt-strong'
            }`}
          >
            {localeNames[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
