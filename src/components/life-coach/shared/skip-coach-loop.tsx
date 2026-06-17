'use client';

import {useTranslations} from 'next-intl';
import {REFLECTION_BLOCKER_REASONS, type ReflectionBlockerReason} from '@/lib/life-coach/types';
import {SKIP_COACH_ACTIONS, type SkipCoachAction} from '@/lib/skip-coach-loop';
import {BusyButton} from '@/components/feedback/busy-button';

type Props = {
  blockerReason: ReflectionBlockerReason | null;
  onBlockerChange: (reason: ReflectionBlockerReason | null) => void;
  onSelectAction: (action: SkipCoachAction) => Promise<void>;
  busy?: boolean;
  compact?: boolean;
  introMessage?: string | null;
};

export function SkipCoachLoop({
  blockerReason,
  onBlockerChange,
  onSelectAction,
  busy = false,
  compact = false,
  introMessage,
}: Props) {
  const t = useTranslations('lifeCoach.skipCoach');
  const tLife = useTranslations('lifeCoach');

  return (
    <div className={compact ? 'space-y-3' : 'mt-4 space-y-4 rounded-xl border border-sky-400/20 bg-sky-500/6 p-4'}>
      <div>
        <p id="skip-coach-blocker-label" className="text-xs font-bold uppercase tracking-wide text-sky-200/80">{t('whatStopped')}</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="skip-coach-blocker-label">
          {REFLECTION_BLOCKER_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              aria-pressed={blockerReason === reason}
              className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                blockerReason === reason
                  ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                  : 'border-[color:var(--color-border)] fill-1 txt-soft hover:border-[color:var(--color-border-strong)]'
              }`}
              onClick={() => onBlockerChange(blockerReason === reason ? null : reason)}
            >
              {tLife(`blockers.${reason}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p id="skip-coach-tomorrow-label" className="text-xs font-bold uppercase tracking-wide text-sky-200/80">{t('tomorrowTitle')}</p>
        <p className="mt-1 text-xs leading-5 txt-muted">
          {introMessage ?? t('tomorrowHint')}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-labelledby="skip-coach-tomorrow-label">
          {SKIP_COACH_ACTIONS.map((action) => (
            <BusyButton
              key={action}
              type="button"
              className="focus-ring rounded-xl border border-[color:var(--color-border)] fill-1 px-3 py-3 text-left text-sm font-semibold txt-strong transition hover:border-[var(--blue)]/40 hover:bg-[rgba(26,109,255,0.08)]"
              busy={busy}
              busyLabel={t('saving')}
              onClick={() => onSelectAction(action)}
            >
              <span className="block txt-strong">{t(`actions.${action}.title`)}</span>
              <span className="mt-1 block text-[11px] font-normal leading-4 txt-muted">
                {t(`actions.${action}.hint`)}
              </span>
            </BusyButton>
          ))}
        </div>
      </div>
    </div>
  );
}
