'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {DailyBabyStep, Goal, LifeDomain, LifeDomainState, Milestone} from '@/lib/life-coach/types';
import {buildHeatMap, computeStreak} from '@/lib/life-coach/streak-utils';
import {lifeCoachApi} from '@/lib/life-coach/api-client';

type GoalWithMilestones = Goal & {milestones?: Milestone[]};

type Props = {
  domain: LifeDomain;
  state: LifeDomainState | null;
  goals: GoalWithMilestones[];
  allRecentSteps: DailyBabyStep[];
  onRefresh?: () => Promise<void> | void;
};

export function ProgressDashboard({domain, state, goals, allRecentSteps, onRefresh}: Props) {
  const t = useTranslations();
  const [updatingMilestone, setUpdatingMilestone] = useState<string | null>(null);

  const heatMap = useMemo(
    () => buildHeatMap(allRecentSteps, 84, domain),
    [allRecentSteps, domain]
  );

  const streak = useMemo(
    () => computeStreak(allRecentSteps, domain),
    [allRecentSteps, domain]
  );

  // Health Score over time simulation (using current score as latest point)
  const currentScore = state?.current_score ?? 0;

  // Progress toward first goal
  const activeGoal = goals.find((g) => g.domain === domain && g.status === 'active');
  const goalProgress = useMemo(() => {
    if (!activeGoal) return null;

    const goalSteps = allRecentSteps.filter((s) => s.goal_id === activeGoal.id);
    const completed = goalSteps.filter((s) => s.status === 'completed').length;
    const total = goalSteps.length;

    return {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      goalTitle: activeGoal.title,
    };
  }, [activeGoal, allRecentSteps]);

  // 90-day timeline position + milestone markers
  const timeline = useMemo(() => {
    if (!activeGoal?.created_at) return null;
    const start = new Date(activeGoal.created_at);
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const dayIndex = Math.max(0, Math.floor((now.getTime() - start.getTime()) / msPerDay));
    const totalDays = 90;
    const clamped = Math.min(dayIndex, totalDays);

    // Map goal milestones to % positions on the bar
    const milestoneMarkers = (activeGoal.milestones ?? [])
      .filter((m) => m.target_date != null)
      .map((m) => {
        const targetDay = Math.max(0, Math.floor((new Date(m.target_date!).getTime() - start.getTime()) / msPerDay));
        const clampedDay = Math.min(targetDay, totalDays);
        return {
          id: m.id,
          title: m.title,
          dayIndex: clampedDay,
          percent: Math.round((clampedDay / totalDays) * 100),
          completed: m.status === 'completed',
          isPast: dayIndex >= clampedDay,
        };
      })
      .sort((a, b) => a.dayIndex - b.dayIndex);

    return {
      dayIndex: clamped,
      totalDays,
      percent: Math.round((clamped / totalDays) * 100),
      remaining: Math.max(0, totalDays - clamped),
      checkpoints: [10, 20, 30, 40, 50, 60, 70, 80, 90].map((day) => ({
        day,
        reached: clamped >= day,
        current: clamped < day && clamped >= day - 10,
        percent: Math.round((day / totalDays) * 100),
      })),
      milestoneMarkers,
    };
  }, [activeGoal]);

  // Month-over-month comparison
  const monthComparison = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;

    const thisMonthSteps = allRecentSteps.filter(
      (s) => s.domain === domain && s.scheduled_date.startsWith(thisMonth)
    );
    const lastMonthSteps = allRecentSteps.filter(
      (s) => s.domain === domain && s.scheduled_date.startsWith(lastMonth)
    );

    const thisCompleted = thisMonthSteps.filter((s) => s.status === 'completed').length;
    const lastCompleted = lastMonthSteps.filter((s) => s.status === 'completed').length;

    return {
      thisMonth: thisCompleted,
      lastMonth: lastCompleted,
      diff: thisCompleted - lastCompleted,
    };
  }, [allRecentSteps, domain]);

  return (
    <section className="panel-surface p-6" aria-label={t('healthDashboard.title')}>
      <p className="eyebrow">
        {t('healthDashboard.eyebrowForDomain', {domain: t(`lifeCoach.domains.${domain}.label`)})}
      </p>
      <h2 className="mt-4 text-2xl font-black txt-strong">{t('healthDashboard.title')}</h2>

      <div className="mt-6 grid gap-6">
        {/* Health Score */}
        <div className="grid gap-4 sm:grid-cols-3">
          <ScoreCard
            label={t('healthDashboard.healthScore')}
            info={t('healthDashboard.healthScoreInfo')}
            value={currentScore}
            max={10}
            color="blue"
          />
          <ScoreCard
            label={t('healthDashboard.consistencyRate')}
            info={t('healthDashboard.consistencyRateInfo')}
            value={streak.consistency_rate}
            max={100}
            suffix="%"
            color="green"
          />
          <div className="rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4">
            <p className="field-label mb-0 flex items-center gap-1.5 txt-muted">
              {t('healthDashboard.vsLastMonth')}
              <InfoDot text={t('healthDashboard.vsLastMonthInfo')} />
            </p>
            <p className={`mt-2 text-2xl font-black ${monthComparison.diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {monthComparison.diff >= 0 ? '+' : ''}{monthComparison.diff}
            </p>
            <p className="mt-1 text-xs txt-muted">
              {monthComparison.thisMonth} {t('healthDashboard.thisMonth')} / {monthComparison.lastMonth} {t('healthDashboard.lastMonth')}
            </p>
          </div>
        </div>

        {/* Goal Progress Bar */}
        {goalProgress && (
          <div className="rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold txt-strong">
                {goalProgress.goalTitle}
                <InfoDot text={t('healthDashboard.goalProgressInfo')} />
              </p>
              <span className="text-sm font-bold text-[var(--blue)]">{goalProgress.percent}%</span>
            </div>
            <div
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full fill-3"
              role="progressbar"
              aria-valuenow={goalProgress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={goalProgress.goalTitle}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--blue)] to-blue-400 transition-all duration-500"
                style={{width: `${Math.min(goalProgress.percent, 100)}%`}}
              />
            </div>
            <p className="mt-2 text-xs txt-muted">
              {goalProgress.completed}/{goalProgress.total} {t('healthDashboard.stepsCompleted')}
            </p>
          </div>
        )}

        {/* 90-Day Timeline with milestone markers */}
        {timeline && (
          <div className="rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="field-label mb-0 txt-muted">{t('healthDashboard.timelineTitle')}</p>
              <span className="text-xs font-semibold txt-soft">
                {timeline.dayIndex === 0
                  ? t('healthDashboard.timelineNotStarted')
                  : t('healthDashboard.daysPassed', {count: timeline.dayIndex})}
              </span>
            </div>
            {/* Bar */}
            <div
              className="relative mt-8 mb-2 h-2 rounded-full fill-3"
              role="progressbar"
              aria-valuenow={timeline.dayIndex}
              aria-valuemin={0}
              aria-valuemax={timeline.totalDays}
              aria-label={t('healthDashboard.timelineTitle')}
            >
              {/* Progress fill */}
              <div
                className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-[var(--blue)] to-blue-400 transition-all duration-500"
                style={{width: `${timeline.percent}%`}}
              />
              {/* Day-30/60/90 tick marks */}
              {[30, 60, 90].map((marker) => (
                <div
                  key={marker}
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{insetInlineStart: `${(marker / timeline.totalDays) * 100}%`}}
                >
                  <div
                    className={`h-3 w-[2px] -translate-x-1/2 rtl:translate-x-1/2 ${
                      timeline.dayIndex >= marker ? 'bg-[var(--color-text)]' : 'fill-3'
                    }`}
                  />
                  <span className="absolute top-3 -translate-x-1/2 rtl:translate-x-1/2 whitespace-nowrap text-[10px] txt-faint">
                    {t('healthDashboard.timelineDayLabel', {day: marker})}
                  </span>
                </div>
              ))}
              {/* Milestone diamond markers */}
              {timeline.milestoneMarkers.map((m) => (
                <div
                  key={m.id}
                  className="absolute z-20"
                  style={{insetInlineStart: `${m.percent}%`, top: '-18px'}}
                >
                  <div
                    className={`-translate-x-1/2 rtl:translate-x-1/2 cursor-help text-base leading-none transition-transform hover:scale-125 ${
                      m.completed ? 'opacity-100' : m.isPast ? 'opacity-60' : 'opacity-40'
                    }`}
                    aria-label={`${m.title} — ${t('healthDashboard.timelineDayLabel', {day: m.dayIndex})}`}
                  >
                    {m.completed ? '✓' : '·'}
                  </div>
                  <div
                    className="absolute top-5 -translate-x-1/2 rtl:translate-x-1/2 whitespace-nowrap rounded-full border border-white/12 bg-[#0b1220] px-2 py-0.5 text-[9px] font-semibold text-white/50 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
                    style={{maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis'}}
                  >
                    {m.title}
                  </div>
                </div>
              ))}
              {/* "You are here" dot */}
              <div
                className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2 rounded-full border-2 border-[var(--blue)] bg-[#0b1220] shadow-[0_0_0_3px_rgba(26,109,255,0.25)] transition-all duration-500"
                style={{insetInlineStart: `${timeline.percent}%`}}
                aria-label={t('healthDashboard.timelineDayLabel', {day: timeline.dayIndex})}
              />
            </div>
            {/* Milestone legend */}
            {timeline.milestoneMarkers.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-x-4 gap-y-1">
                {timeline.milestoneMarkers.map((m) => (
                  <span key={m.id} className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${m.completed ? 'text-emerald-400' : m.isPast ? 'txt-muted' : 'txt-soft'}`}>
                    <span>{m.completed ? '✓' : '·'} {m.title}</span>
                    <span className="ms-1 txt-faint">
                      ({t('healthDashboard.timelineDayLabel', {day: m.dayIndex})})
                    </span>
                    <button
                      type="button"
                      className="focus-ring rounded-full border border-[color:var(--color-border)] px-2 py-0.5 text-[10px] txt-soft transition hover:border-[var(--blue)] hover:txt-strong"
                      disabled={updatingMilestone === m.id}
                      aria-busy={updatingMilestone === m.id}
                      onClick={async () => {
                        setUpdatingMilestone(m.id);
                        try {
                          await lifeCoachApi.updateMilestoneStatus(m.id, m.completed ? 'pending' : 'completed');
                          await onRefresh?.();
                        } finally {
                          setUpdatingMilestone(null);
                        }
                      }}
                    >
                      {m.completed ? t('lifeCoach.reopenMilestone') : t('lifeCoach.completeMilestone')}
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className={`text-xs txt-muted ${timeline.milestoneMarkers.length > 0 ? 'mt-3' : 'mt-6'}`}>
              {t('healthDashboard.daysRemaining', {count: timeline.remaining})}
            </p>

            <div className="mt-5 rounded-2xl border border-[color:var(--color-border)] bg-black/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest txt-faint">
                    {t('healthDashboard.questMapTitle')}
                  </p>
                  <p className="mt-1 text-sm txt-muted">
                    {t('healthDashboard.questMapBody')}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--blue)]/20 bg-[var(--blue)]/8 px-3 py-1 text-xs font-black text-blue-200">
                  {timeline.percent}%
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-9">
                {timeline.checkpoints.map((checkpoint) => (
                  <div
                    key={checkpoint.day}
                    className={`rounded-2xl border px-2 py-3 text-center transition ${
                      checkpoint.reached
                        ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-300'
                        : checkpoint.current
                          ? 'border-[var(--blue)]/35 bg-[var(--blue)]/[0.09] text-blue-200 shadow-[0_0_20px_rgba(26,109,255,0.12)]'
                          : 'border-[color:var(--color-border)] fill-1 txt-faint'
                    }`}
                    aria-label={t('healthDashboard.questMapDay', {day: checkpoint.day})}
                  >
                    <p className="text-base font-black">{checkpoint.reached ? '✓' : checkpoint.current ? '•' : '·'}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider">
                      {t('healthDashboard.timelineDayLabel', {day: checkpoint.day})}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Heat Map */}
        <div>
          <p className="field-label mb-3 txt-muted">{t('healthDashboard.activityMap')}</p>
          <div className="flex flex-wrap gap-[3px]">
            {heatMap.map((day) => (
              <div
                key={day.date}
                className="h-3 w-3 rounded-[3px] transition-colors"
                style={{backgroundColor: heatLevelColor(day.level)}}
                aria-label={`${day.date}: ${heatLevelLabel(day.level, t)}`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] txt-muted" aria-hidden="true">
            <span>{t('healthDashboard.less')}</span>
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <div
                key={level}
                className="h-3 w-3 rounded-[3px]"
                style={{backgroundColor: heatLevelColor(level)}}
              />
            ))}
            <span>{t('healthDashboard.more')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoDot({text}: {text: string}) {
  return (
    <span
      tabIndex={0}
      title={text}
      aria-label={text}
      className="focus-ring inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[color:var(--color-border-strong)] text-[10px] font-bold txt-muted transition-colors hover:border-[color:var(--color-border-strong)] hover:txt-soft"
    >
      i
    </span>
  );
}

function ScoreCard({
  label,
  info,
  value,
  max,
  suffix = '',
  color,
}: {
  label: string;
  info?: string;
  value: number;
  max: number;
  suffix?: string;
  color: 'blue' | 'green';
}) {
  const t = useTranslations();
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const ringColor = color === 'blue' ? 'var(--blue)' : '#22c55e';

  const levelKey =
    percent <= 30 ? 'scoreLevelLow'
    : percent <= 60 ? 'scoreLevelMedium'
    : percent <= 85 ? 'scoreLevelGood'
    : 'scoreLevelExcellent';

  const tipKey =
    percent <= 30 ? 'scoreTipLow'
    : percent <= 60 ? 'scoreTipMedium'
    : percent <= 85 ? 'scoreTipGood'
    : 'scoreTipExcellent';

  const levelColor =
    percent <= 30 ? 'text-red-400'
    : percent <= 60 ? 'text-amber-400'
    : percent <= 85 ? 'text-emerald-400'
    : 'text-[var(--blue)]';

  return (
    <div className="rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4">
      <p className="field-label mb-0 flex items-center gap-1.5 txt-muted">
        {label}
        {info && <InfoDot text={info} />}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-14 w-14">
          <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke={ringColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(percent / 100) * 150.8} 150.8`}
            />
          </svg>
        </div>
        <div>
          <span className="text-3xl font-black txt-strong">{value}{suffix}</span>
          <p className={`mt-0.5 text-xs font-bold ${levelColor}`}>{t(`healthDashboard.${levelKey}`)}</p>
        </div>
      </div>
      {percent > 0 && (
        <p className="mt-3 text-xs leading-5 txt-muted">{t(`healthDashboard.${tipKey}`)}</p>
      )}
    </div>
  );
}

function heatLevelColor(level: 0 | 1 | 2 | 3 | 4): string {
  const colors: Record<number, string> = {
    0: 'rgba(255,255,255,0.04)',
    1: 'rgba(26,109,255,0.2)',
    2: 'rgba(26,109,255,0.4)',
    3: 'rgba(26,109,255,0.65)',
    4: 'rgba(26,109,255,0.9)',
  };
  return colors[level] ?? colors[0]!;
}

function heatLevelLabel(level: 0 | 1 | 2 | 3 | 4, t: ReturnType<typeof useTranslations>): string {
  const labels: Record<number, string> = {
    0: t('healthDashboard.noActivity'),
    1: t('healthDashboard.lowActivity'),
    2: t('healthDashboard.mediumActivity'),
    3: t('healthDashboard.highActivity'),
    4: t('healthDashboard.fullActivity'),
  };
  return labels[level] ?? labels[0]!;
}
