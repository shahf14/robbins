'use client';

import {useEffect, useMemo, useState} from 'react';
import {clearDomainGoalWizardDraft, DOMAIN_GOAL_DRAFT_KEY} from '@/lib/open-process-drafts';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/config';
import type {LifeDomain, LifeDomainState, NonHealthDomain} from '@/lib/life-coach/types';
import {goalInspirationStarterKeys, orderDomainCategories} from '@/lib/life-context-content';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {loadUserPreferences} from '@/lib/user-preferences';
import {AIGoalPreview} from './ai-goal-preview';
import {ExpandableTextarea} from './expandable-textarea';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {AiGeneratingProgress} from './shared/ai-generating-progress';
import {GoalCelebration} from './shared/goal-celebration';
import {GoalHierarchyExplainer} from './shared/goal-hierarchy-explainer';
import {GoalWizardAiBuildPreview} from './shared/goal-wizard-ai-build-preview';
import {MilestonesWhyExplainer} from './shared/milestones-why-explainer';

type Props = {
  domain: NonHealthDomain;
  assessment: LifeDomainState | null;
  onCreated: () => Promise<void>;
};

const TOTAL_STEPS = 3;
const OTHER_CATEGORY = '__other__';
const GOAL_EXAMPLE_KEYS = ['domainWizard.goalExample1', 'domainWizard.goalExample2'] as const;

export function DomainGoalWizard({domain, assessment, onCreated}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [goalText, setGoalText] = useState('');
  const [milestone30, setMilestone30] = useState('');
  const [milestone60, setMilestone60] = useState('');
  const [milestone90, setMilestone90] = useState('');
  const [inspiring, setInspiring] = useState(false);
  const [inspiringMilestones, setInspiringMilestones] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof lifeCoachApi.structureGoal>> | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const prefs = useMemo(() => loadUserPreferences(), []);
  const {ordered: categories, recommended} = useMemo(
    () => orderDomainCategories(domain, prefs.life_context_statuses),
    [domain, prefs.life_context_statuses]
  );
  const goalStarterKeys = useMemo(
    () => goalInspirationStarterKeys(domain, prefs.life_context_statuses),
    [domain, prefs.life_context_statuses]
  );
  const effectiveCategory = category === OTHER_CATEGORY ? customCategory.trim() : category;

  useEffect(() => {
    if (preview || celebrating) return;
    if (step === 1 && !category) return;
    try {
      window.localStorage.setItem(
        DOMAIN_GOAL_DRAFT_KEY,
        JSON.stringify({
          domain,
          step,
          category,
          customCategory,
          goalText,
          milestone30,
          milestone60,
          milestone90,
        })
      );
    } catch {
      /* ignore */
    }
  }, [
    preview,
    celebrating,
    domain,
    step,
    category,
    customCategory,
    goalText,
    milestone30,
    milestone60,
    milestone90,
  ]);

  function canProceed() {
    if (step === 1) return effectiveCategory.length > 0;
    if (step === 2) return goalText.trim().length > 0;
    if (step === 3) return milestone30.trim().length > 0 && milestone60.trim().length > 0;
    return false;
  }

  async function handleInspireMe() {
    setInspiring(true);
    setErrorMessage(null);
    try {
      const result = await lifeCoachApi.inspireGoal({locale, domain, category: effectiveCategory});
      setGoalText(result.inspiration);
    } catch {
      setErrorMessage(t('domainWizard.inspireError'));
    }
    setInspiring(false);
  }

  async function handleInspireMilestones() {
    setInspiringMilestones(true);
    setErrorMessage(null);
    try {
      const result = await lifeCoachApi.inspireMilestones({locale, domain, category: effectiveCategory, goal_text: goalText});
      setMilestone30(result.days_30);
      setMilestone60(result.days_60);
      setMilestone90(result.days_90);
    } catch {
      setErrorMessage(t('domainWizard.inspireError'));
    }
    setInspiringMilestones(false);
  }

  async function handleCreateWithAi() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const {coaching_style} = loadUserPreferences();
      const result = await lifeCoachApi.structureGoal({
        locale,
        domain,
        raw_goal: goalText,
        deadline: null,
        motivation: `Focus area: ${effectiveCategory}. 30-day goal: ${milestone30}. 60-day goal: ${milestone60}. 90-day goal: ${milestone90}.`,
        constraints: '',
        available_time_per_day: assessment?.available_time_per_day ?? 10,
        domain_category: effectiveCategory,
        milestones_30_60_90: {days_30: milestone30, days_60: milestone60, days_90: milestone90},
        coaching_style,
      });
      setPreview(result);
    } catch {
      setErrorMessage(t('domainWizard.createError'));
    }
    setLoading(false);
  }

  if (celebrating) {
    return (
      <GoalCelebration title={t('healthWizard.celebrateTitle')} body={t('healthWizard.celebrateBody')}>
        <Link href="/life-coach" className="focus-ring btn-primary w-full justify-center">
          {t('healthWizard.celebrateViewToday')}
        </Link>
        <button
          type="button"
          className="focus-ring btn-ghost w-full justify-center"
          onClick={() => {
            setCelebrating(false);
            setStep(1);
            setCategory('');
            setCustomCategory('');
            setGoalText('');
            setMilestone30('');
            setMilestone60('');
            setMilestone90('');
          }}
        >
          {t('healthWizard.celebrateAnotherDomain')}
        </button>
        <button
          type="button"
          className="focus-ring btn-ghost w-full justify-center"
          onClick={async () => {
            setCelebrating(false);
            await onCreated();
          }}
        >
          {t('healthWizard.celebrateDone')}
        </button>
      </GoalCelebration>
    );
  }

  if (preview) {
    return (
      <AIGoalPreview
        domain={domain}
        preview={preview}
        onCancel={() => setPreview(null)}
        onSave={async (input) => {
          await lifeCoachApi.createGoal(input);
          clearDomainGoalWizardDraft();
          setPreview(null);
          setCelebrating(true);
        }}
      />
    );
  }

  return (
    <section className="panel-surface p-6">
      <p className="eyebrow">{t('domainWizard.eyebrow')}</p>
      <h3 className="mt-4 text-2xl font-black text-white">{t('domainWizard.title')}</h3>
      <GoalHierarchyExplainer className="mt-4" />

      <div
        className="mt-4 flex gap-1"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={t('domainWizard.stepProgress', {step, total: TOTAL_STEPS})}
      >
        {Array.from({length: TOTAL_STEPS}, (_, i) => (
          <div
            key={`step-${i}`}
            className={`h-1 flex-1 rounded-full transition-colors ${i < step ? 'bg-[var(--blue)]' : 'bg-white/10'}`}
          />
        ))}
      </div>

      <div className="mt-6">
        {step === 1 && (
          <div>
            <p className="field-label mb-4">{t('domainWizard.step1Title')}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={category === cat}
                  onClick={() => setCategory(cat)}
                  className={`focus-ring rounded-[18px] border p-4 text-left transition-colors ${
                    category === cat
                      ? 'border-[var(--blue)] bg-[var(--blue)]/10 text-white'
                      : 'border-white/10 bg-white/3 text-[var(--muted)] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span className="text-sm font-semibold">
                    {t(`domainWizard.categories.${domain}.${cat}`)}
                  </span>
                  {recommended.has(cat) ? (
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--blue)]">
                      {t('lifeContext.recommended')}
                    </span>
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={category === OTHER_CATEGORY}
                onClick={() => setCategory(OTHER_CATEGORY)}
                className={`focus-ring rounded-[18px] border p-4 text-left transition-colors ${
                  category === OTHER_CATEGORY
                    ? 'border-[var(--blue)] bg-[var(--blue)]/10 text-white'
                    : 'border-white/10 bg-white/3 text-[var(--muted)] hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="text-sm font-semibold">{t('domainWizard.otherCategory')}</span>
              </button>
            </div>
            {category === OTHER_CATEGORY && (
              <label className="mt-4 grid gap-1.5">
                <span className="sr-only">{t('domainWizard.otherCategory')}</span>
                <input
                  className="focus-ring input-base"
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                  placeholder={t('domainWizard.otherPlaceholder')}
                  autoFocus
                />
              </label>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <p className="field-label mb-0">{t('domainWizard.step2Title')}</p>
            <p className="text-sm text-[var(--muted)]">{t('domainWizard.step2Hint')}</p>
            <ExpandableTextarea
              label=""
              value={goalText}
              onChange={setGoalText}
              placeholder={t('domainWizard.goalPlaceholder')}
              context={t('expandText.contextGoal')}
              minHeight="min-h-32"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-full text-xs text-white/45">{t('domainWizard.goalExamplesLabel')}</span>
              {GOAL_EXAMPLE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="focus-ring rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-semibold text-white/60 hover:border-white/20 hover:text-white transition"
                  onClick={() => setGoalText((prev) => (prev ? prev : t(key)))}
                >
                  {t(key)}
                </button>
              ))}
            </div>
            {goalStarterKeys.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {goalStarterKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="focus-ring rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-semibold text-white/60 hover:border-white/20 hover:text-white transition"
                    onClick={() => setGoalText((prev) => prev ? prev : t(key))}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="focus-ring btn-ghost inline-flex items-center gap-2 self-start"
              disabled={inspiring}
              aria-busy={inspiring}
              onClick={handleInspireMe}
            >
              {inspiring && (
                <span
                  aria-hidden
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                />
              )}
              {inspiring ? t('domainWizard.inspiring') : t('domainWizard.inspireMe')}
            </button>
            {errorMessage && <p role="alert" className="text-sm text-red-400">{errorMessage}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <p className="field-label mb-0">{t('domainWizard.step3Title')}</p>
            <MilestonesWhyExplainer />
            <button
              type="button"
              className="focus-ring btn-ghost inline-flex items-center gap-2 self-start"
              disabled={inspiringMilestones}
              aria-busy={inspiringMilestones}
              onClick={handleInspireMilestones}
            >
              {inspiringMilestones && (
                <span
                  aria-hidden
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                />
              )}
              {inspiringMilestones ? t('domainWizard.inspiring') : t('domainWizard.inspireMilestones')}
            </button>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white/70">{t('domainWizard.day30')}</span>
              <input
                className="focus-ring input-base"
                value={milestone30}
                onChange={(event) => setMilestone30(event.target.value)}
                placeholder={t('domainWizard.day30Placeholder')}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white/70">{t('domainWizard.day60')}</span>
              <input
                className="focus-ring input-base"
                value={milestone60}
                onChange={(event) => setMilestone60(event.target.value)}
                placeholder={t('domainWizard.day60Placeholder')}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white/70">{t('domainWizard.day90')} ({t('domainWizard.optional')})</span>
              <input
                className="focus-ring input-base"
                value={milestone90}
                onChange={(event) => setMilestone90(event.target.value)}
                placeholder={t('domainWizard.day90Placeholder')}
              />
            </label>
            {errorMessage && <p role="alert" className="text-sm text-red-400">{errorMessage}</p>}
          </div>
        )}
      </div>

      {step === TOTAL_STEPS && !loading && <GoalWizardAiBuildPreview className="mt-6" />}

      {loading && (
        <div className="mt-6">
          <AiGeneratingProgress />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {step > 1 && (
          <button
            type="button"
            className="focus-ring btn-ghost"
            onClick={() => {
              setErrorMessage(null);
              setStep((s) => s - 1);
            }}
          >
            {t('domainWizard.back')}
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            className="focus-ring btn-primary"
            disabled={!canProceed()}
            onClick={() => setStep((s) => s + 1)}
          >
            {t('domainWizard.next')}
          </button>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              className="focus-ring btn-primary"
              disabled={loading || !canProceed()}
              aria-busy={loading}
              onClick={handleCreateWithAi}
            >
              {loading ? t('domainWizard.generating') : t('domainWizard.createWithAi')}
            </button>
            <AiActionHelpMicrocopy kind="goalStructure" />
          </div>
        )}
      </div>
    </section>
  );
}
