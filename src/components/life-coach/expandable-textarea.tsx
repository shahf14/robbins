'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {lifeCoachApi} from '@/lib/life-coach/api-client';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  context: string;
  minHeight?: string;
};

export function ExpandableTextarea({label, value, onChange, placeholder, context, minHeight = 'min-h-20'}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExpand() {
    if (!value.trim()) return;
    setExpanding(true);
    setError(null);
    try {
      const result = await lifeCoachApi.expandText({text: value, context, locale});
      onChange(result.expanded);
    } catch {
      setError(t('expandText.error'));
    }
    setExpanding(false);
  }

  return (
    <label className="grid gap-2">
      <span className="field-label mb-0">{label}</span>
      <textarea
        className={`focus-ring textarea-base ${minHeight}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          disabled={expanding || !value.trim()}
          aria-busy={expanding}
          onClick={handleExpand}
        >
          {expanding ? t('expandText.expanding') : t('expandText.expand')}
        </button>
        {error && <span role="alert" className="text-xs text-red-400">{error}</span>}
      </div>
    </label>
  );
}
