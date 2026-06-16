'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {
  buildFormulationExportDocument,
  downloadTextFile,
  formulationExportFilename,
} from '@/lib/formulation/export-wizard-data';
import type {WizardLiveDraft} from '@/lib/formulation/wizard-live-draft';
import type {FormulationSession} from '@/lib/life-coach/types';

type Props = {
  session: FormulationSession;
  liveDraft?: WizardLiveDraft;
  compact?: boolean;
};

export function FormulationExportMenu({session, liveDraft, compact}: Props) {
  const t = useTranslations('formulation');
  const locale = useLocale() as AppLocale;
  const [status, setStatus] = useState<string | null>(null);

  function buildDoc() {
    return buildFormulationExportDocument(session, locale, liveDraft);
  }

  async function copyMarkdown() {
    setStatus(null);
    try {
      const {markdown} = buildDoc();
      await navigator.clipboard.writeText(markdown);
      setStatus(t('export.copied'));
    } catch {
      setStatus(t('export.copyFailed'));
    }
  }

  function downloadMarkdown() {
    setStatus(null);
    const {markdown} = buildDoc();
    downloadTextFile(
      formulationExportFilename(session, 'md'),
      markdown,
      'text/markdown'
    );
    setStatus(t('export.downloadedMd'));
  }

  function downloadJson() {
    setStatus(null);
    const {json} = buildDoc();
    downloadTextFile(formulationExportFilename(session, 'json'), json, 'application/json');
    setStatus(t('export.downloadedJson'));
  }

  const btnClass = compact
    ? 'focus-ring rounded-lg border border-white/15 bg-white/4 px-2.5 py-1.5 text-[10px] font-semibold text-white/70 hover:text-white'
    : 'focus-ring rounded-lg border border-white/15 bg-white/4 px-3 py-2 text-xs font-semibold text-white/70 hover:border-white/25 hover:text-white';

  return (
    <div className={compact ? 'flex flex-col gap-2' : 'mt-4'}>
      {!compact && (
        <p className="text-xs text-white/45">{t('export.hint')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnClass} onClick={() => void copyMarkdown()}>
          {t('export.copyMarkdown')}
        </button>
        <button type="button" className={btnClass} onClick={downloadMarkdown}>
          {t('export.downloadMd')}
        </button>
        <button type="button" className={btnClass} onClick={downloadJson}>
          {t('export.downloadJson')}
        </button>
      </div>
      {status && (
        <p className="text-[10px] text-[var(--accent)]" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
