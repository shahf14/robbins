'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';

type RiskAnswer = 0 | 1 | null;

type Props = {
  loading: boolean;
  crisisStopped: boolean;
  needsFollowUp: boolean;
  onSubmit: (input: {
    risk_q1: RiskAnswer;
    risk_q2: RiskAnswer;
    risk_follow_up_confirmed?: boolean | null;
  }) => void;
};

export function RiskScreenStep({loading, crisisStopped, needsFollowUp, onSubmit}: Props) {
  const t = useTranslations('formulation');
  const [q1, setQ1] = useState<RiskAnswer>(null);
  const [q2, setQ2] = useState<RiskAnswer>(null);
  const [followUp, setFollowUp] = useState<boolean | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);

  if (crisisStopped) {
    return (
      <div className="grid gap-6" role="alert">
        <div className="rounded-[20px] border border-[color:var(--color-border)] fill-1 p-5 sm:p-6">
          <h3 className="text-xl font-black txt-strong">{t('crisis.title')}</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t('crisis.body')}</p>
          <p className="mt-3 text-sm leading-7 txt-soft">{t('crisis.guidance')}</p>
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold leading-7 txt-strong">
            {t('crisis.resources')}
          </p>
        </div>
        <Link className="focus-ring btn-primary text-center" href="/">
          {t('crisis.exit')}
        </Link>
      </div>
    );
  }

  function answerButton(value: RiskAnswer, selected: RiskAnswer, onSelect: (v: RiskAnswer) => void, label: string) {
    return (
      <button
        type="button"
        aria-pressed={selected === value}
        className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold ${
          selected === value
            ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
            : 'border-[color:var(--color-border)] txt-soft'
        }`}
        onClick={() => onSelect(value)}
      >
        {label}
      </button>
    );
  }

  const canSubmit =
    q1 !== null &&
    q2 !== null &&
    (!showFollowUp && !needsFollowUp || followUp !== null);

  return (
    <div className="grid gap-6">
      <p className="text-sm font-semibold txt-strong">{t('risk.q1')}</p>
      <div className="flex flex-wrap gap-2">
        {answerButton(1, q1, setQ1, t('risk.yes'))}
        {answerButton(0, q1, setQ1, t('risk.no'))}
      </div>

      <p className="text-sm font-semibold txt-strong">{t('risk.q2')}</p>
      <div className="flex flex-wrap gap-2">
        {answerButton(1, q2, setQ2, t('risk.yes'))}
        {answerButton(0, q2, setQ2, t('risk.no'))}
      </div>

      {(showFollowUp || needsFollowUp) && (q1 === 1 || q2 === 1) && (
        <div className="grid gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm txt-strong">{t('risk.followUp')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={followUp === true}
              className="focus-ring btn-small"
              onClick={() => setFollowUp(true)}
            >
              {t('risk.followUpYes')}
            </button>
            <button
              type="button"
              aria-pressed={followUp === false}
              className="focus-ring btn-ghost text-xs"
              onClick={() => setFollowUp(false)}
            >
              {t('risk.followUpNo')}
            </button>
          </div>
        </div>
      )}

      <button
        className="focus-ring btn-primary"
        type="button"
        disabled={loading || !canSubmit}
        aria-busy={loading}
        onClick={() => {
          const yesAnswer = q1 === 1 || q2 === 1;
          if (yesAnswer && followUp === null && !showFollowUp) {
            setShowFollowUp(true);
            return;
          }
          onSubmit({
            risk_q1: q1,
            risk_q2: q2,
            risk_follow_up_confirmed: yesAnswer ? followUp : null,
          });
        }}
      >
        {loading ? t('saving') : t('save')}
      </button>
    </div>
  );
}
