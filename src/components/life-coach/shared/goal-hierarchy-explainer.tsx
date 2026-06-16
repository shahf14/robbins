'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

const ITEMS = [
  {labelKey: 'lifeCoach.goalHierarchyGoal', roleKey: 'lifeCoach.goalHierarchyGoalRole'},
  {labelKey: 'lifeCoach.goalHierarchyMilestone', roleKey: 'lifeCoach.goalHierarchyMilestoneRole'},
  {labelKey: 'lifeCoach.goalHierarchyDailyStep', roleKey: 'lifeCoach.goalHierarchyDailyStepRole'},
] as const;

export function GoalHierarchyExplainer({className = ''}: Props) {
  const t = useTranslations();

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/3 px-4 py-3 ${className}`}
      role="note"
      aria-label={t('lifeCoach.goalHierarchyAria')}
    >
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {ITEMS.map((item, index) => (
          <div
            key={item.labelKey}
            className={index < ITEMS.length - 1 ? 'sm:border-e sm:border-white/10 sm:pe-4' : ''}
          >
            <p className="text-sm font-bold text-white">
              {t(item.labelKey)}
              <span className="font-semibold text-white/45"> = </span>
              <span className="font-semibold text-white/70">{t(item.roleKey)}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
