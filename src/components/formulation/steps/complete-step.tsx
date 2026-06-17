'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/config';
import type {FormulationSession, LifeDomain, DailyBabyStep} from '@/lib/life-coach/types';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {isFirstWinStep, firstWinDisplayReasoning} from '@/lib/formulation/first-win-routing';
import {loadUserPreferences} from '@/lib/user-preferences';
import {FormulationExportMenu} from '@/components/formulation/formulation-export-menu';
import {PersonalizedChallengeCard} from '@/components/formulation/personalized-challenge-card';
import {buildPersonalizedChallenge} from '@/lib/formulation/personalized-challenge';

type Props = {session: FormulationSession};

/**
 * Shown after formulation is marked complete.
 *
 * Responsibilities:
 *  1. Celebrate the completion.
 *  2. Surface the key insight from the formulation so it feels connected.
 *  3. Bridge directly to Life Coach: one-click goal creation in the right domain.
 *  4. Auto-generate today's baby steps in the background.
 */
export function CompleteStep({session}: Props) {
  const t      = useTranslations('formulation');
  const tc     = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [generating, setGenerating] = useState(false);
  const [generated,  setGenerated]  = useState(false);
  const [genError,   setGenError]   = useState<string | null>(null);
  const [firstWinStep, setFirstWinStep] = useState<DailyBabyStep | null>(null);

  const handoff   = session.coach_handoff;
  const approved  = session.formulation_approved;
  const challenge = buildPersonalizedChallenge(session, locale);

  // ── Derive suggested domain from handoff ──────────────────────────────────
  const suggestedDomain = deriveDomainFromHandoff(handoff?.suggested_domain);

  // ── Auto-generate today's baby steps once the session is complete ─────────
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      const prefs = loadUserPreferences();
      setGenerating(true);
      lifeCoachApi
        .generateDailySteps({
          locale,
          wake_time:               prefs.wake_time,
          sleep_time:              prefs.sleep_time,
          coaching_style:          prefs.coaching_style,
          physical_considerations: prefs.physical_considerations,
          preferred_action_window: prefs.preferred_action_window,
          include_first_win:       true,
          force:                   true,
        })
        .then((res) => {
          if (cancelled) return;
          setGenerated(true);
          setFirstWinStep(res.steps.find(isFirstWinStep) ?? null);
        })
        .catch((e) => {
          if (!cancelled) {
            setGenError(e instanceof Error ? e.message : 'Could not generate steps.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setGenerating(false);
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [locale]);

  return (
    <div className="grid gap-6">
      {/* ── Celebration header ───────────────────────────────────────────── */}
      <div className="panel-surface-strong overflow-hidden rounded-[24px] p-6 sm:p-8">
        <span className="inline-block text-4xl" aria-hidden="true">✅</span>
        <h2 className="mt-4 text-2xl font-black txt-strong">{t('complete.title')}</h2>
        <p className="mt-3 leading-7 text-[var(--muted)]">{t('complete.body')}</p>
      </div>

      {/* ── Key insight from formulation ─────────────────────────────────── */}
      {approved && (
        <div className="panel-surface rounded-[20px] p-5">
          <p className="field-label mb-0 text-[var(--blue)]">{t('complete.insightLabel')}</p>
          {approved.presenting_concern_user_words && (
            <blockquote className="mt-3 border-s-2 border-[var(--blue)]/40 ps-4 text-base font-semibold leading-7 txt-strong">
              &ldquo;{approved.presenting_concern_user_words}&rdquo;
            </blockquote>
          )}
          {approved.existing_strengths.length > 0 && (
            <p className="mt-3 text-sm leading-6 txt-soft">
              {t('complete.strengthsLabel')}:{' '}
              <span className="txt-strong">
                {approved.existing_strengths.join(' · ')}
              </span>
            </p>
          )}
        </div>
      )}

      {/* ── Micro-goal bridge ─────────────────────────────────────────────── */}
      {handoff?.micro_goal_week && (
        <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/6 p-5">
          <p className="field-label mb-0 text-emerald-400">{t('complete.microGoalLabel')}</p>
          <p className="mt-3 text-base font-bold leading-7 txt-strong">
            {handoff.micro_goal_week}
          </p>
        </div>
      )}

      {challenge && <PersonalizedChallengeCard challenge={challenge} variant="complete" />}

      {firstWinStep && (
        <div className="rounded-[20px] border border-amber-500/25 bg-amber-500/8 p-5">
          <p className="field-label mb-0 text-amber-300">{t('complete.firstWinLabel')}</p>
          <p className="mt-3 text-base font-bold leading-7 txt-strong">{firstWinStep.title}</p>
          {firstWinDisplayReasoning(firstWinStep) && (
            <p className="mt-2 text-sm leading-6 txt-soft">
              {firstWinDisplayReasoning(firstWinStep)}
            </p>
          )}
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-200/80">
            {t('complete.firstWinMinutes', {minutes: firstWinStep.estimated_minutes})}
          </p>
        </div>
      )}

      {/* ── Daily steps status ────────────────────────────────────────────── */}
      <div aria-live="polite" className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
        generated
          ? 'border-emerald-500/25 bg-emerald-500/6 text-emerald-300'
          : genError
          ? 'border-red-500/25 bg-red-500/6 text-red-300'
          : 'border-[color:var(--color-border)] fill-1 txt-soft'
      }`}>
        {generating && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-border-strong)]" aria-hidden="true" />
        )}
        {generated  && <span aria-hidden="true">✓</span>}
        {genError   && <span aria-hidden="true">⚠</span>}
        <span>
          {generating ? t('complete.generatingSteps')
           : generated ? t('complete.stepsReady')
           : genError  ? t('complete.stepsError')
           : ''}
        </span>
      </div>

      {/* ── Primary CTA: go to Life Coach ────────────────────────────────── */}
      <div className="grid gap-3">
        {suggestedDomain ? (
          <Link
            href={`/life-coach/${suggestedDomain}`}
            className="focus-ring btn-primary w-full justify-center text-center"
          >
            {t('complete.toCoachDomain', {
              domain: tc(`lifeCoach.domains.${suggestedDomain}.label`),
            })}
          </Link>
        ) : (
          <Link
            href="/life-coach"
            className="focus-ring btn-primary w-full justify-center text-center"
          >
            {t('complete.toCoach')}
          </Link>
        )}

        <Link href="/" className="focus-ring btn-ghost w-full justify-center text-center">
          {t('complete.toHome')}
        </Link>
      </div>

      {/* ── Export / secondary actions ────────────────────────────────────── */}
      <FormulationExportMenu session={session} />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveDomainFromHandoff(raw?: string | null): LifeDomain | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, '_');
  return (LIFE_DOMAINS as readonly string[]).includes(normalized)
    ? (normalized as LifeDomain)
    : null;
}
