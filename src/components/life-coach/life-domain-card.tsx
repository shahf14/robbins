'use client';

import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {DomainCardSummary, LifeDomain} from '@/lib/life-coach/types';

function masteryLevel(summary: DomainCardSummary): 1 | 2 | 3 | 4 {
  const scorePoints = ((summary.current_score ?? 0) / 10) * 35;
  const goalPoints = Math.min(summary.active_goals_count, 2) * 15;
  const progressPoints = (summary.progress_percent / 100) * 35;
  const total = scorePoints + goalPoints + progressPoints;

  if (total >= 80) return 4;
  if (total >= 55) return 3;
  if (total >= 25) return 2;
  return 1;
}

export function LifeDomainCard({summary}: {summary: DomainCardSummary}) {
  const t = useTranslations();
  const isUntouched = summary.current_score == null && summary.active_goals_count === 0;
  const mastery = masteryLevel(summary);

  return (
    <Link
      href={`/life-coach/${summary.domain}`}
      className={`focus-ring interactive-panel group block overflow-hidden rounded-[22px] p-5 transition-all duration-200 hover:-translate-y-0.5 ${
        isUntouched
          ? 'border border-dashed border-white/15 bg-white/[0.015] opacity-80 hover:border-[var(--blue)]/40 hover:opacity-100'
          : 'panel-surface border-l-2 border-l-[var(--blue)] shadow-[0_0_0_1px_rgba(26,109,255,0.12)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="field-label mb-0 text-white/45">{t(`lifeCoach.domains.${summary.domain}.short`)}</p>
          <h3 className="mt-3 text-xl font-black text-white">{t(`lifeCoach.domains.${summary.domain}.label`)}</h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          {!isUntouched && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--blue)]/30 bg-[rgba(26,109,255,0.12)] px-2.5 py-1 text-[11px] font-bold text-[var(--blue)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--blue)]" />
              {t('lifeCoach.cardActiveChip')}
            </span>
          )}
          <div className="text-end">
            {summary.current_score != null && (
              <p className="field-label mb-1 text-white/40">{t('lifeCoach.domainScoreLabel')}</p>
            )}
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${
                isUntouched
                  ? 'border-dashed border-white/20 bg-transparent text-white/55'
                  : 'border-white/12 bg-white/4 text-white/72'
              }`}
            >
              {summary.current_score != null ? `${summary.current_score}/10` : t('lifeCoach.notSet')}
            </span>
          </div>
        </div>
      </div>

      {isUntouched ? (
        <>
          {/* Skeleton placeholders mirroring the active layout so card heights match */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-hidden>
            <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.015] p-4">
              <div className="h-2.5 w-16 rounded-full bg-white/10" />
              <div className="mt-3 h-4 w-10 rounded-full bg-white/7" />
            </div>
            <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.015] p-4">
              <div className="h-2.5 w-16 rounded-full bg-white/10" />
              <div className="mt-3 h-4 w-20 rounded-full bg-white/7" />
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-white/65">
            {t(`lifeCoach.domains.${summary.domain}.setupValue`)}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-[var(--blue)]/25 bg-[rgba(26,109,255,0.07)] p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue)]/15 text-lg" aria-hidden />
              <div>
                <p className="text-sm font-bold leading-5 text-white">{t('lifeCoach.cardStartCta')}</p>
                <p className="mt-0.5 text-xs text-white/50">{t('lifeCoach.cardSetupTime')}</p>
              </div>
            </div>
            <span className="shrink-0 text-lg font-bold text-[var(--blue)] transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden="true">
              →
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <p className="rounded-[18px] border border-white/10 bg-white/3 p-4 text-sm leading-7 text-white/80">
              <span className="field-label mb-0 block text-white/45">{t('lifeCoach.activeGoals')}</span>
              <span className="mt-2 block text-lg font-bold text-white">{summary.active_goals_count}</span>
            </p>
            <p className="rounded-[18px] border border-white/10 bg-white/3 p-4 text-sm leading-7 text-white/80">
              <span className="field-label mb-0 block text-white/45">{t('lifeCoach.todayStatus')}</span>
              <span className="mt-2 block text-base font-semibold text-white">
                {t(`lifeCoach.stepStatus.${summary.today_baby_step_status}`)}
              </span>
            </p>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-sm text-white/60">
              <span>{t('lifeCoach.progress')}</span>
              <span>{summary.progress_percent}%</span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={summary.progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('lifeCoach.progress')}
            >
              <div
                className="h-full rounded-full bg-[var(--blue)] transition-all duration-500"
                style={{width: `${summary.progress_percent}%`}}
              />
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-white/10 bg-white/3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="field-label mb-0 text-white/45">{t('lifeCoach.mastery.title')}</p>
                <p className="mt-1 text-sm font-black text-white">
                  {t(`lifeCoach.mastery.levels.${mastery}`)}
                </p>
              </div>
              <span className="rounded-full border border-[var(--blue)]/25 bg-[var(--blue)]/8 px-3 py-1 text-xs font-black text-blue-200">
                {t('lifeCoach.mastery.level', {level: mastery})}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className={`h-1.5 rounded-full ${level <= mastery ? 'bg-[var(--blue)]' : 'bg-white/10'}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </Link>
  );
}
