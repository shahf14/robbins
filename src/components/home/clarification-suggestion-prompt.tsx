'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {formulationApi} from '@/lib/life-coach/api-client';
import {
  dismissClarificationSuggestion,
  isClarificationSuggestionAvailable,
} from '@/lib/clarification-suggestion';

export function ClarificationSuggestionPrompt() {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!isClarificationSuggestionAvailable()) {
      setVisible(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    formulationApi
      .getGate()
      .then(({gate}) => {
        const show = Boolean(gate.suggested) && !gate.required;
        setVisible(show);
        setDraftId(gate.draft_id ?? null);
      })
      .catch(() => setVisible(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (loading || !visible) return null;

  const href = draftId ? `/clarification?resume=${draftId}` : '/clarification';

  return (
    <section
      className="rounded-[18px] border border-[var(--blue)]/22 bg-[var(--blue)]/[0.07] px-4 py-4 sm:px-5"
      aria-label={t('home.clarificationSuggestion.aria')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black txt-strong">{t('home.clarificationSuggestion.title')}</p>
          <p className="mt-1 text-sm leading-6 txt-muted">{t('home.clarificationSuggestion.body')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="focus-ring rounded-full px-3 py-1.5 text-xs font-bold txt-muted hover:txt-soft"
            onClick={() => {
              dismissClarificationSuggestion(1);
              setVisible(false);
            }}
          >
            {t('home.clarificationSuggestion.later')}
          </button>
          <button
            type="button"
            className="focus-ring rounded-full px-3 py-1.5 text-xs font-bold txt-muted hover:txt-soft"
            onClick={() => {
              dismissClarificationSuggestion(7);
              setVisible(false);
            }}
          >
            {t('home.clarificationSuggestion.hideWeek')}
          </button>
        </div>
      </div>
      <Link className="focus-ring btn-primary mt-4 inline-flex text-sm" href={href}>
        {draftId ? t('home.clarificationSuggestion.resume') : t('home.clarificationSuggestion.cta')}
      </Link>
    </section>
  );
}
