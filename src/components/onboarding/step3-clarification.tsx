'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import type {AppLocale} from '@/i18n/config';
import type {LifeContextStatus, LifeDomain} from '@/lib/life-coach/types';
import {
  buildHelpMeAnswers,
  buildQuickAnswers,
  isLowestDomain,
  isQuickClarificationReady,
  type ClarificationAnswers,
  type QuickClarificationInput,
} from '@/lib/onboarding-clarification';
import {
  buildStep3Reflection,
  getStep3DomainContent,
} from '@/lib/onboarding-step3-content';
import {getLifeWheelBandColor, getLifeWheelRatingKeys} from '@/lib/life-wheel';

const DOMAIN_ICONS: Record<LifeDomain, string> = {
  health: '🏃', time: '⏰', wealth: '💰', career: '📈',
  relationships: '❤️', mind: '🧠', spirit: '🌟', house_family: '🏠',
};

type Props = {
  locale: AppLocale;
  domain: LifeDomain;
  domainScore: number;
  domainScores: Record<LifeDomain, number>;
  lifeContextStatuses?: LifeContextStatus[];
  quickClarification: QuickClarificationInput;
  onQuickClarificationChange: (input: QuickClarificationInput) => void;
  insight: string | null;
  insightLoading: boolean;
  goalLoading: boolean;
  setAnswers: (answers: ClarificationAnswers) => void;
  onBack: () => void;
  onGenerateInsight: (answers: ClarificationAnswers, articulationHelp?: boolean) => Promise<void>;
  onNext: () => void;
};

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function Step3Clarification({
  locale,
  domain,
  domainScore,
  domainScores,
  quickClarification,
  onQuickClarificationChange,
  insight,
  insightLoading,
  goalLoading,
  setAnswers,
  onBack,
  onGenerateInsight,
  onNext,
}: Props) {
  const t = useTranslations();
  const busy = goalLoading || insightLoading;

  const {painTagIds, visionTagIds, painNote, visionNote} = quickClarification;
  const [phraseHelpOpen, setPhraseHelpOpen] = useState(false);

  function patchQuickClarification(patch: Partial<QuickClarificationInput>) {
    onQuickClarificationChange({...quickClarification, ...patch});
  }

  const isLowest = isLowestDomain(domain, domainScores);
  const content = useMemo(
    () => getStep3DomainContent(domain, locale, isLowest),
    [domain, locale, isLowest]
  );

  const reflection = useMemo(
    () => buildStep3Reflection(domain, locale, painTagIds),
    [domain, locale, painTagIds]
  );

  const quickInput = quickClarification;
  const canGenerateInsight = isQuickClarificationReady(quickInput);
  const showInsight = !!(insight && canGenerateInsight);

  function syncAnswers(input = quickInput): ClarificationAnswers {
    const answers = buildQuickAnswers(locale, domain, domainScore, domainScores, input);
    setAnswers(answers);
    return answers;
  }

  async function handleGenerateInsight() {
    await onGenerateInsight(syncAnswers());
  }

  async function handleHelpMe() {
    const answers = buildHelpMeAnswers(locale, domain, domainScore, domainScores, quickInput);
    setAnswers(answers);
    await onGenerateInsight(answers, true);
  }

  function applyStarterPhrase(phrase: string) {
    patchQuickClarification({painNote: phrase});
    setPhraseHelpOpen(false);
  }

  const domainLabel = t(`lifeCoach.domains.${domain}.label`);
  const rating = getLifeWheelRatingKeys(domain, domainScore);
  const scoreColor = getLifeWheelBandColor(domainScore);
  const bandLabel = t(rating.bandLabelKey);

  const chipClass = (selected: boolean) =>
    `focus-ring rounded-2xl border px-4 py-3 text-sm font-medium leading-snug transition ${
      selected
        ? 'border-[var(--blue)]/60 bg-[var(--blue)]/10 text-white'
        : 'border-white/8 bg-white/[0.02] text-white/65 hover:border-white/15 hover:bg-white/[0.04]'
    }`;

  return (
    <div className="flex flex-col gap-10">
      <header className="grid gap-4">
        <p className="eyebrow text-[var(--blue)]">{t('onboarding.step3Eyebrow')}</p>
        <h1 className="text-[clamp(1.75rem,5vw,2.35rem)] font-black leading-tight text-white">
          {content.title}
        </h1>
        <p className="max-w-prose text-base leading-7 text-white/60">{content.intro}</p>

        <div className="mt-1 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3.5">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white/70">
            <span aria-hidden="true">{DOMAIN_ICONS[domain]}</span>
            <span>{domainLabel}</span>
          </p>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/30">
            {t('onboarding.step3Quick.scoreLabel')}
          </p>
          <p className="mt-1 text-lg font-black text-white">
            <span className="tabular-nums" style={{color: scoreColor}}>
              {rating.score}/10
            </span>
            <span className="text-white/30"> · </span>
            <span style={{color: scoreColor}}>{bandLabel}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-white/50">{t(rating.descriptionKey)}</p>
        </div>
      </header>

      <section className="grid gap-5">
        <div>
          <h2 className="text-lg font-bold text-white">{content.painQuestion}</h2>
          <p className="mt-1.5 text-sm leading-6 text-white/45">{content.painHint}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {content.painChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={painTagIds.includes(chip.id)}
              onClick={() =>
                patchQuickClarification({
                  painTagIds: toggleId(painTagIds, chip.id),
                })
              }
              className={chipClass(painTagIds.includes(chip.id))}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {reflection && (
          <div className="rounded-2xl border border-[var(--blue)]/15 bg-[var(--blue)]/[0.04] px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]/80">
              {t('onboarding.step3Quick.reflectionEyebrow')}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/85">{reflection.summary}</p>
            <p className="mt-2 text-sm leading-6 text-white/55">{reflection.goal}</p>
          </div>
        )}

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => setPhraseHelpOpen((open) => !open)}
            className="focus-ring self-start text-sm font-semibold text-[var(--blue)]/80 underline decoration-[var(--blue)]/25 underline-offset-4 transition hover:text-[var(--blue)]"
          >
            {t('onboarding.step3Quick.phraseHelpToggle')}
          </button>
          {phraseHelpOpen && (
            <div className="grid gap-2 rounded-2xl border border-white/6 bg-white/[0.02] p-3">
              <p className="text-xs leading-5 text-white/40">{t('onboarding.step3Quick.phraseHelpHint')}</p>
              {content.starterPhrases.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => applyStarterPhrase(phrase)}
                  className="focus-ring rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5 text-start text-sm leading-6 text-white/70 transition hover:border-white/12 hover:bg-white/[0.04] hover:text-white/90"
                >
                  {phrase}
                </button>
              ))}
            </div>
          )}
          <textarea
            className="focus-ring textarea-base min-h-[88px] resize-none"
            value={painNote}
            onChange={(e) => patchQuickClarification({painNote: e.target.value})}
            placeholder={content.painPlaceholder}
            maxLength={300}
            aria-label={t('onboarding.step3Quick.optionalNote')}
          />
        </div>
      </section>

      <section className="grid gap-5">
        <div>
          <h2 className="text-lg font-bold text-white">{content.visionQuestion}</h2>
          <p className="mt-1.5 text-sm leading-6 text-white/45">{content.visionHint}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {content.visionChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={visionTagIds.includes(chip.id)}
              onClick={() =>
                patchQuickClarification({
                  visionTagIds: toggleId(visionTagIds, chip.id),
                })
              }
              className={chipClass(visionTagIds.includes(chip.id))}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <textarea
          className="focus-ring textarea-base min-h-[88px] resize-none"
          value={visionNote}
          onChange={(e) => patchQuickClarification({visionNote: e.target.value})}
          placeholder={content.visionPlaceholder}
          maxLength={300}
          aria-label={t('onboarding.step3Quick.optionalNote')}
        />
      </section>

      {!showInsight && !canGenerateInsight && (
        <button
          type="button"
          disabled={busy}
          onClick={handleHelpMe}
          className="focus-ring self-start text-sm font-semibold text-white/40 underline decoration-white/15 underline-offset-4 transition hover:text-white/65"
        >
          {t('onboarding.helpMeExpress')}
        </button>
      )}

      {showInsight && (
        <div className="rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/[0.05] p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">
            {t('onboarding.insightLabel')}
          </p>
          <p className="mt-3 text-base leading-7 text-white/90">{insight}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" className="focus-ring btn-ghost" onClick={onBack} disabled={busy} aria-busy={busy}>
          {t('onboarding.back')}
        </button>
        {showInsight ? (
          <button
            type="button"
            className="focus-ring btn-primary flex-1 justify-center disabled:opacity-50"
            disabled={busy}
            aria-busy={busy}
            onClick={onNext}
          >
            {busy ? t('onboarding.generating') : <>{t('onboarding.continueToGoal')} <span aria-hidden="true">→</span></>}
          </button>
        ) : (
          <button
            type="button"
            className="focus-ring btn-primary flex-1 justify-center disabled:opacity-50"
            disabled={!canGenerateInsight || busy}
            aria-busy={busy}
            onClick={handleGenerateInsight}
          >
            {busy ? t('onboarding.generating') : <>{t('onboarding.step3Quick.buildInsight')} <span aria-hidden="true">→</span></>}
          </button>
        )}
      </div>
      <AiActionHelpMicrocopy
        kind={showInsight ? 'onboardingGoal' : 'onboardingInsight'}
        className="mt-3"
      />
    </div>
  );
}
