'use client';

import {useMemo, useState, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {chipAnswerDisplayLabel, parseChipSeverity} from '@/lib/formulation/chip-flare-filter';
import {distressWeight} from '@/lib/formulation/passive-ratings';
import {
  getGuidedQuestionBody,
  getGuidedQuestionById,
  type GuidedQuestionEntry,
} from '@/lib/formulation/guided-questions';
import {isParticipantGender} from '@/lib/formulation/participant-profile';
import {normalizeWizardPhase, WIZARD_PHASES} from '@/lib/formulation/phase-nav';
import type {WizardLiveDraft} from '@/lib/formulation/wizard-live-draft';
import type {FormulationPhase, FormulationSession} from '@/lib/life-coach/types';

type Props = {
  session: FormulationSession;
  phase: FormulationPhase;
  locale: AppLocale;
  guidedQuestions: GuidedQuestionEntry[];
  draft: WizardLiveDraft;
};

/* ── Phase metadata ─────────────────────────────────────── */

const PHASE_ICONS: Record<string, string> = {
  consent: '✔',     // ✔
  open: '⭐',        // ⭐
  dimensions: '⚙',  // ⚙
  exploration: '🔬', // 🔬
  formulation: '📄', // 📄
  goal: '🎯', // 🎯
};

type PhaseStatus = 'completed' | 'current' | 'upcoming';

function getPhaseStatus(sectionPhase: FormulationPhase, currentPhase: FormulationPhase): PhaseStatus {
  const currentIdx = WIZARD_PHASES.indexOf(currentPhase);
  const sectionIdx = WIZARD_PHASES.indexOf(sectionPhase);
  if (sectionIdx < currentIdx) return 'completed';
  if (sectionIdx === currentIdx) return 'current';
  return 'upcoming';
}

function sectionDefaultOpen(sectionPhase: FormulationPhase, currentPhase: FormulationPhase): boolean {
  return sectionPhase === currentPhase;
}

/* ── Score indicators ───────────────────────────────────── */

function ScoreDots({score, max = 5}: {score: number; max?: number}) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${score}/${max}`}>
      {Array.from({length: max}, (_, i) => (
        <span
          key={`dot-${i}`}
          className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
            i < score ? 'bg-[var(--blue)]' : 'fill-3'
          }`}
        />
      ))}
    </span>
  );
}

function MiniProgressBar({value, max, label}: {value: number; max: number; label: string}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] txt-muted">{label}</span>
        <span className="text-[10px] font-semibold tabular-nums txt-soft">{pct}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full fill-3">
        <div
          className="h-full rounded-full bg-[var(--blue)] transition-all duration-500"
          style={{width: `${pct}%`}}
        />
      </div>
    </div>
  );
}

/* ── Chip badge ─────────────────────────────────────────── */

const CHIP_COLORS: Record<string, string> = {
  a_lot: 'border-red-400/40 bg-red-400/10 text-red-300',
  moderate: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  a_little: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  not_at_all: 'border-[color:var(--color-border-strong)] fill-1 txt-muted',
  not_sure: 'border-[color:var(--color-border-strong)] fill-1 txt-muted',
};

function ChipBadge({chip, label}: {chip: string; label: string}) {
  const cls = CHIP_COLORS[chip] ?? CHIP_COLORS.not_sure!;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

/* ── Section wrapper ────────────────────────────────────── */

function SummarySection({
  title,
  icon,
  status,
  defaultOpen,
  badge,
  children,
}: {
  title: string;
  icon?: string;
  status: PhaseStatus;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? status !== 'upcoming');

  const statusDot =
    status === 'completed'
      ? 'bg-emerald-400'
      : status === 'current'
        ? 'bg-[var(--blue)] animate-pulse'
        : 'fill-3';

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors ${
        status === 'current'
          ? 'border-[var(--blue)]/30 bg-[rgba(26,109,255,0.04)]'
          : status === 'completed'
            ? 'border-[color:var(--color-border)] fill-1'
            : 'border-[color:var(--color-border)] bg-transparent'
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start transition-colors hover:fill-1"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {/* Status dot */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} aria-hidden="true" />

        {/* Icon */}
        {icon && <span className="text-xs" aria-hidden="true">{icon}</span>}

        {/* Title */}
        <span
          className={`flex-1 text-xs font-semibold tracking-wide ${
            status === 'upcoming' ? 'txt-faint' : 'txt-strong'
          }`}
        >
          {title}
        </span>

        {/* Badge */}
        {badge}

        {/* Chevron */}
        <svg
          className={`h-3 w-3 shrink-0 txt-faint transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="grid gap-2 px-3.5 pb-3 pt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Data row variants ──────────────────────────────────── */

function DataRow({label, value, muted}: {label: string; value: string; muted?: boolean}) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="shrink-0 text-[10px] leading-relaxed txt-faint">{label}</span>
      <span
        className={`ms-auto text-end text-xs leading-snug ${
          muted ? 'txt-muted' : 'txt-strong'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RatingRow({
  ratingId,
  label,
  score,
  useDistress = true,
}: {
  ratingId?: string;
  label: string;
  score: number;
  useDistress?: boolean;
}) {
  const dots = useDistress && ratingId ? distressWeight(ratingId, score) : score;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="min-w-0 flex-1 truncate text-[11px] leading-snug txt-soft">{label}</span>
      <ScoreDots score={dots} />
    </div>
  );
}

function ChipRow({label, answer, chipKey}: {label: string; answer: string; chipKey: string}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="min-w-0 flex-1 truncate text-[11px] leading-snug txt-soft">{label}</span>
      <ChipBadge chip={chipKey} label={answer} />
    </div>
  );
}

/* ── Formulation card ───────────────────────────────────── */

function FormulationCard({session, t}: {session: FormulationSession; t: ReturnType<typeof useTranslations>}) {
  const f = session.formulation_approved;
  if (!f) return null;
  return (
    <div className="grid gap-2">
      <div className="rounded-lg fill-1 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider txt-faint">
          {t('liveSummary.central')}
        </p>
        <p className="mt-1 text-xs leading-relaxed txt-strong">
          {f.presenting_concern_user_words}
        </p>
      </div>
      {f.stressors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {f.stressors.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-md border border-red-400/20 bg-red-400/5 px-2 py-0.5 text-[10px] text-red-300/80"
            >
              {s}
            </span>
          ))}
        </div>
      )}
      {f.existing_strengths.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {f.existing_strengths.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[10px] text-emerald-300/80"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Goal card ──────────────────────────────────────────── */

function GoalCard({session, t}: {session: FormulationSession; t: ReturnType<typeof useTranslations>}) {
  const h = session.coach_handoff;
  if (!h) return null;
  return (
    <div className="grid gap-2">
      <div className="rounded-lg bg-[rgba(26,109,255,0.06)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider txt-faint">
          {t('liveSummary.microGoal')}
        </p>
        <p className="mt-1 text-xs font-medium leading-relaxed txt-strong">
          {h.micro_goal_week}
        </p>
      </div>
      {h.value && (
        <DataRow label={t('liveSummary.goalValue')} value={h.value} />
      )}
      {h.anticipated_barrier && (
        <DataRow label={t('liveSummary.goalBarrier')} value={h.anticipated_barrier} muted />
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */

export function FormulationLiveSummary({session, phase, locale, guidedQuestions, draft}: Props) {
  const t = useTranslations('formulation');

  /* ── Profile data ── */
  const profile = useMemo(() => {
    const c = draft.consent;
    const contexts =
      c?.life_context_statuses?.length
        ? c.life_context_statuses
        : session.life_context_statuses;
    const gender =
      c?.gender ??
      (session.participant_gender && isParticipantGender(session.participant_gender)
        ? session.participant_gender
        : null);
    const age = c?.age != null ? c.age : session.participant_age;
    const note = c?.life_context_status_note ?? session.life_context_status_note;
    const hasProfile =
      contexts.length > 0 ||
      gender != null ||
      age != null ||
      !!note;
    return {contexts, gender, age, note, hasProfile};
  }, [draft.consent, session]);

  /* ── Ratings data ── */
  const ratingsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of session.passive_ratings) map.set(r.key, r.score);
    for (const r of draft.passive_ratings ?? []) map.set(r.key, r.score);
    return map;
  }, [session.passive_ratings, draft.passive_ratings]);

  const ratingsEntries = useMemo(() => {
    const ids =
      guidedQuestions.length > 0
        ? guidedQuestions.map((q) => q.id)
        : [...ratingsMap.keys()];
    return ids
      .filter((id) => ratingsMap.has(id))
      .map((id) => {
        const q = getGuidedQuestionById(id);
        return {
          id,
          label: q ? getGuidedQuestionBody(q, locale) : id,
          score: ratingsMap.get(id)!,
        };
      });
  }, [guidedQuestions, ratingsMap, locale]);

  const ratingsProgress = useMemo(() => {
    const total = guidedQuestions.length;
    const answered = guidedQuestions.filter((q) => ratingsMap.has(q.id)).length;
    return {answered, total};
  }, [guidedQuestions, ratingsMap]);

  /* ── Sorted ratings (top distress first) ── */
  const topRatings = useMemo(
    () =>
      [...ratingsEntries]
        .sort((a, b) => distressWeight(b.id, b.score) - distressWeight(a.id, a.score))
        .slice(0, 8),
    [ratingsEntries]
  );

  /* ── Follow-ups data ── */
  const followUps = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of session.prior_question_answers) map.set(a.key, a.answer);
    for (const a of draft.follow_up_answers ?? []) {
      if (a.answer.trim()) map.set(a.key, a.answer);
    }
    const labelByKey = new Map(
      session.rating_follow_ups.map((f) => [f.key, f.questionKey] as const)
    );
    return [...map.entries()].map(([key, answer]) => ({
      key,
      chipKey: parseChipSeverity(answer, locale),
      answer: chipAnswerDisplayLabel(answer, locale),
      label: labelByKey.has(key) ? t(labelByKey.get(key)!) : key,
    }));
  }, [session.prior_question_answers, draft.follow_up_answers, session.rating_follow_ups, locale, t]);

  /* ── Exploration data ── */
  const explorationAnswers = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of session.llm_exploration_answers) map.set(a.key, a.score);
    for (const a of draft.llm_exploration_answers ?? []) {
      if (a.score >= 1 && a.score <= 5) map.set(a.key, a.score);
    }
    const labelById = new Map(
      session.llm_exploration_questions.map((q) => [q.id, q.text] as const)
    );
    return [...map.entries()].map(([key, score]) => ({
      key,
      score,
      label: labelById.get(key) ?? key,
    }));
  }, [
    session.llm_exploration_answers,
    draft.llm_exploration_answers,
    session.llm_exploration_questions,
  ]);

  const explorationProgress = useMemo(() => {
    const total = session.llm_exploration_questions.length;
    const answered = explorationAnswers.length;
    return {answered, total};
  }, [session.llm_exploration_questions.length, explorationAnswers.length]);

  /* ── Top exploration insights ── */
  const topExploration = useMemo(
    () => [...explorationAnswers].sort((a, b) => b.score - a.score).slice(0, 6),
    [explorationAnswers]
  );

  /* ── Overall completion ── */
  const completedSections = useMemo(() => {
    let count = 0;
    if (profile.hasProfile) count++;
    if (ratingsEntries.length > 0) count++;
    if (followUps.length > 0 || session.phases_skipped?.includes('follow_ups')) count++;
    if (explorationAnswers.length > 0) count++;
    if (session.formulation_approved) count++;
    if (session.coach_handoff) count++;
    return count;
  }, [profile, session, ratingsEntries, followUps, explorationAnswers]);

  const hasAnything =
    profile.hasProfile ||
    ratingsEntries.length > 0 ||
    followUps.length > 0 ||
    explorationAnswers.length > 0 ||
    session.formulation_approved != null ||
    session.coach_handoff != null;

  const displayPhase = normalizeWizardPhase(phase, session.status);

  /* ── Phase labels ── */
  const phaseLabel = (p: FormulationPhase) => t(`liveSummary.phases.${p}`);

  return (
    <aside className="panel-surface sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden lg:max-h-[calc(100vh-5rem)]" aria-label={t('liveSummary.title')}>
      {/* ── Header ── */}
      <div className="border-b border-[color:var(--color-border)] px-4 pb-3 pt-4 md:px-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold txt-strong">{t('liveSummary.title')}</p>
          <span className="rounded-full fill-2 px-2 py-0.5 text-[10px] font-semibold tabular-nums txt-muted">
            {completedSections}/7
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed txt-muted">{t('liveSummary.subtitle')}</p>

        {/* Overall progress bar */}
        <div className="mt-3 h-1 overflow-hidden rounded-full fill-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--blue)] to-[var(--accent)] transition-all duration-700"
            style={{width: `${Math.round((completedSections / 7) * 100)}%`}}
          />
        </div>
      </div>

      {/* ── Scrollable sections ── */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-3 scrollbar-thin md:px-3">
        {!hasAnything && (
          <p className="mb-2 rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-5 text-center text-xs leading-relaxed txt-muted">
            {t('liveSummary.empty')}
          </p>
        )}

        {/* 1. Profile & Context */}
        <SummarySection
          title={phaseLabel('consent')}
          icon={PHASE_ICONS.consent}
          status={getPhaseStatus('consent', displayPhase)}
          defaultOpen={sectionDefaultOpen('consent', displayPhase)}
          badge={
            profile.hasProfile ? (
              <span className="text-[10px] text-emerald-400/70">
                {profile.contexts.length > 0
                  ? profile.contexts.map((s) => t(`consent.contexts.${s}`)).join(', ')
                  : ''}
              </span>
            ) : undefined
          }
        >
          {profile.hasProfile ? (
            <div className="grid gap-1">
              {profile.contexts.length > 0 && (
                <DataRow
                  label={t('liveSummary.lifeContext')}
                  value={profile.contexts.map((s) => t(`consent.contexts.${s}`)).join(' · ')}
                />
              )}
              {profile.gender && (
                <DataRow
                  label={t('liveSummary.gender')}
                  value={t(`consent.genderOptions.${profile.gender}`)}
                />
              )}
              {profile.age != null && (
                <DataRow
                  label={t('liveSummary.age')}
                  value={String(profile.age)}
                />
              )}
              {profile.note && (
                <DataRow label={t('liveSummary.note')} value={profile.note} />
              )}
            </div>
          ) : (
            <p className="text-[10px] txt-faint">{t('liveSummary.notFilled')}</p>
          )}
        </SummarySection>

        {/* 2. Ratings */}
        <SummarySection
          title={phaseLabel('open')}
          icon={PHASE_ICONS.open}
          status={getPhaseStatus('open', displayPhase)}
          defaultOpen={sectionDefaultOpen('open', displayPhase)}
          badge={
            ratingsProgress.total > 0 ? (
              <span className="text-[10px] tabular-nums txt-muted">
                {ratingsProgress.answered}/{ratingsProgress.total}
              </span>
            ) : undefined
          }
        >
          {ratingsProgress.total > 0 && (
            <MiniProgressBar
              value={ratingsProgress.answered}
              max={ratingsProgress.total}
              label={t('liveSummary.ratingsProgress', {
                answered: ratingsProgress.answered,
                total: ratingsProgress.total,
              })}
            />
          )}
          {topRatings.length > 0 ? (
            <div className="grid gap-0.5">
              {topRatings.map((r) => (
                <RatingRow key={r.id} ratingId={r.id} label={r.label} score={r.score} />
              ))}
              {ratingsEntries.length > 8 && (
                <p className="text-[10px] txt-faint">
                  {t('liveSummary.andMore', {count: ratingsEntries.length - 8})}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px] txt-faint">{t('liveSummary.notFilled')}</p>
          )}
        </SummarySection>

        {/* 4. Follow-ups (chips) */}
        <SummarySection
          title={phaseLabel('dimensions')}
          icon={PHASE_ICONS.dimensions}
          status={getPhaseStatus('dimensions', displayPhase)}
          defaultOpen={sectionDefaultOpen('dimensions', displayPhase)}
          badge={
            session.phases_skipped?.includes('follow_ups') ? (
              <span className="text-[10px] txt-faint">{t('liveSummary.skipped')}</span>
            ) : followUps.length > 0 ? (
              <span className="text-[10px] tabular-nums txt-muted">{followUps.length}</span>
            ) : undefined
          }
        >
          {followUps.length > 0 ? (
            <div className="grid gap-1">
              {followUps.map((f) => (
                <ChipRow key={f.key} label={f.label} answer={f.answer} chipKey={f.chipKey} />
              ))}
            </div>
          ) : session.phases_skipped?.includes('follow_ups') ? (
            <p className="text-[10px] italic txt-faint">{t('liveSummary.sectionSkipped')}</p>
          ) : (
            <p className="text-[10px] txt-faint">{t('liveSummary.notFilled')}</p>
          )}
        </SummarySection>

        {/* 5. Exploration */}
        <SummarySection
          title={phaseLabel('exploration')}
          icon={PHASE_ICONS.exploration}
          status={getPhaseStatus('exploration', displayPhase)}
          defaultOpen={sectionDefaultOpen('exploration', displayPhase)}
          badge={
            explorationProgress.total > 0 ? (
              <span className="text-[10px] tabular-nums txt-muted">
                {explorationProgress.answered}/{explorationProgress.total}
              </span>
            ) : undefined
          }
        >
          {explorationProgress.total > 0 && (
            <MiniProgressBar
              value={explorationProgress.answered}
              max={explorationProgress.total}
              label={t('liveSummary.explorationProgress', {
                answered: explorationProgress.answered,
                total: explorationProgress.total,
              })}
            />
          )}
          {topExploration.length > 0 ? (
            <div className="grid gap-0.5">
              {topExploration.map((a) => (
                <RatingRow key={a.key} label={a.label} score={a.score} useDistress={false} />
              ))}
              {explorationAnswers.length > 6 && (
                <p className="text-[10px] txt-faint">
                  {t('liveSummary.andMore', {count: explorationAnswers.length - 6})}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px] txt-faint">{t('liveSummary.notFilled')}</p>
          )}
        </SummarySection>

        {/* 6. Formulation */}
        <SummarySection
          title={phaseLabel('formulation')}
          icon={PHASE_ICONS.formulation}
          status={getPhaseStatus('formulation', displayPhase)}
          defaultOpen={
            sectionDefaultOpen('formulation', displayPhase) || session.formulation_approved != null
          }
        >
          {session.formulation_approved ? (
            <FormulationCard session={session} t={t} />
          ) : (
            <p className="text-[10px] txt-faint">{t('liveSummary.notFilled')}</p>
          )}
        </SummarySection>

        {/* 7. Goal */}
        <SummarySection
          title={phaseLabel('goal')}
          icon={PHASE_ICONS.goal}
          status={getPhaseStatus('goal', displayPhase)}
          defaultOpen={sectionDefaultOpen('goal', displayPhase) || session.coach_handoff != null}
        >
          {session.coach_handoff ? (
            <GoalCard session={session} t={t} />
          ) : (
            <p className="text-[10px] txt-faint">{t('liveSummary.notFilled')}</p>
          )}
        </SummarySection>
      </div>

    </aside>
  );
}
