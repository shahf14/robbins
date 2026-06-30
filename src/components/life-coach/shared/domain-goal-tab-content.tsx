'use client';

import {NavArrow} from '@/components/directional-arrow';
import {useState, type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {useTranslations} from 'next-intl';
import type {
  AiCoachingInsightResponse,
  DailyBabyStepResponse,
  GoalWithMilestonesResponse,
  LifeDomainStateResponse,
} from '@/lib/life-coach/response-dtos';
import type {LifeDomain, Milestone} from '@/lib/life-coach/types';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {hasDomainGoalDraftForDomain} from '@/lib/open-process-drafts';
import {LifeCoachFormulationGate} from '@/components/formulation/life-coach-formulation-gate';
import {DomainAssessmentForm} from '../domain-assessment-form';
import {BlockerDeepDive} from './blocker-deep-dive';
import {GeneralTaskSeriesCreator} from '@/components/simple-tasks/general-task-series-creator';
import {GoalEditCard} from './goal-edit-card';
import {GeneralDailyStepsManager} from './general-daily-steps-manager';

type GoalWithMilestones = GoalWithMilestonesResponse;

type Props = {
  domain: LifeDomain;
  state: LifeDomainStateResponse | null;
  goals: GoalWithMilestones[];
  allRecentSteps?: DailyBabyStepResponse[];
  onRefresh: () => Promise<void>;
  goalWizard: ReactNode;
  topSlot?: ReactNode;
};

export function DomainGoalTabContent({
  domain,
  state,
  goals,
  allRecentSteps = [],
  onRefresh,
  goalWizard,
  topSlot,
}: Props) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const resumeGoal = searchParams.get('resumeGoal') === '1';
  const [activeBlockerDeepDive, setActiveBlockerDeepDive] = useState<string | null>(null);
  const [showNewGoalWizard, setShowNewGoalWizard] = useState(
    () => resumeGoal || hasDomainGoalDraftForDomain(domain)
  );

  const domainGoals = goals.filter((goal) => goal.domain === domain && goal.status === 'active');
  const hasActiveGoal = domainGoals.length > 0;

  const assessmentColumn = (
    <div className="grid gap-0">
      <DomainAssessmentForm
        domain={domain}
        initialState={state}
        onSave={async (input) => {
          await lifeCoachApi.saveAssessment(domain, input);
          await onRefresh();
        }}
      />
      {state?.main_blockers?.[0] && (
        <div className="px-6 pb-4">
          <button
            className="focus-ring text-xs font-semibold text-[var(--blue)]"
            type="button"
            onClick={() =>
              setActiveBlockerDeepDive(
                activeBlockerDeepDive ? null : (state.main_blockers[0] ?? null)
              )
            }
          >
            {activeBlockerDeepDive ? (
              t('blockerDeepDive.save')
            ) : (
              <>
                {t('healthWizard.step4Title')} <NavArrow />
              </>
            )}
          </button>
          {activeBlockerDeepDive && (
            <BlockerDeepDive
              selectedBlocker={activeBlockerDeepDive}
              onDeepDiveComplete={() => setActiveBlockerDeepDive(null)}
            />
          )}
        </div>
      )}
    </div>
  );

  const goalColumn = hasActiveGoal ? (
    <div id="domain-goal-setup" className="scroll-mt-24 grid gap-4">
      <section className="panel-surface p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">
          {t('lifeCoach.assessmentGoalEyebrow')}
        </p>
        <h2 className="mt-2 text-lg font-bold txt-strong">{t('lifeCoach.assessmentGoalTitle')}</h2>
        <p className="mt-1 text-xs leading-6 txt-muted">{t('lifeCoach.assessmentGoalHorizonHint')}</p>
        <div className="mt-5 grid gap-4">
          {domainGoals.map((goal) => (
            <GoalEditCard
              key={goal.id}
              goal={goal}
              weekSteps={allRecentSteps}
              onChanged={onRefresh}
            />
          ))}
        </div>
      </section>
      {!showNewGoalWizard ? (
        <button
          type="button"
          className="focus-ring self-start text-sm font-semibold txt-muted underline decoration-[color:var(--color-border)] underline-offset-4 hover:txt-soft"
          onClick={() => setShowNewGoalWizard(true)}
        >
          {t('lifeCoach.domainTabs.addAnotherGoal')}
        </button>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm txt-muted">{t('lifeCoach.domainTabs.newGoalHint')}</p>
          {goalWizard}
        </div>
      )}
    </div>
  ) : (
    <div id="domain-goal-setup" className="scroll-mt-24">
      <LifeCoachFormulationGate>{goalWizard}</LifeCoachFormulationGate>
    </div>
  );

  return (
    <div className="grid gap-6">
      {topSlot}
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        {assessmentColumn}
        {goalColumn}
      </div>
      <GeneralDailyStepsManager
        domain={domain}
        steps={allRecentSteps}
        onChanged={onRefresh}
      />
      <GeneralTaskSeriesCreator domain={domain} onCreated={onRefresh} />
    </div>
  );
}
