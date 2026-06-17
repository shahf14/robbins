'use client';

import {Link} from '@/i18n/navigation';
import type {useTranslations} from 'next-intl';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import {
  getToolsBarFocus,
  getToolsBarOrder,
  type ToolsBarToolId,
} from '@/lib/schedule-content';

export function HomeToolsBar({
  hasTodayRitual,
  activeGoalCount,
  wakeTime,
  sleepTime,
  lifeContexts,
  recommendedToolsBarId,
  t,
}: {
  hasTodayRitual: boolean;
  activeGoalCount: number;
  wakeTime: string;
  sleepTime: string;
  lifeContexts?: LifeContextStatus[];
  recommendedToolsBarId: ToolsBarToolId;
  t: ReturnType<typeof useTranslations>;
}) {
  const focus = getToolsBarFocus(wakeTime, sleepTime);
  const toolOrder = getToolsBarOrder(focus, lifeContexts);

  if (focus === 'night') {
    return (
      <div className="rounded-[18px] border border-[color:var(--color-border)] fill-1 px-6 py-6 text-center">
        <p className="text-sm font-bold txt-strong">
          {t('schedule.toolsBar.tomorrowAt', {wakeTime})}
        </p>
        <p className="mt-2 text-xs leading-6 txt-muted">
          {t('schedule.toolsBar.nightRest')}
        </p>
        <Link
          href="/evening-reset"
          className="focus-ring mt-4 inline-flex text-xs font-semibold text-[var(--blue)]/90 hover:text-[var(--blue)]"
        >
          {t('schedule.toolsBar.eveningOptional')}
        </Link>
      </div>
    );
  }

  type ToolItem = {
    href: string;
    icon: string;
    label: string;
    whenToUse: string;
    badge: string;
    badgeOk: boolean;
    emphasized?: boolean;
  };

  const morningTool: ToolItem = {
    href: '/morning-priming',
    icon: '🌅',
    label: t('home.toolsMorning'),
    whenToUse: t('home.toolsMorningWhen'),
    badge: hasTodayRitual ? t('home.toolsDone') : t('home.toolsPending'),
    badgeOk: hasTodayRitual,
    emphasized: recommendedToolsBarId === 'morning',
  };
  const eveningTool: ToolItem = {
    href: '/evening-reset',
    icon: '🌙',
    label: t('home.toolsEvening'),
    whenToUse: t('home.toolsEveningWhen'),
    badge: t('schedule.toolsBar.eveningBadge'),
    badgeOk: false,
    emphasized: recommendedToolsBarId === 'evening',
  };
  const coachTool: ToolItem = {
    href: '/life-coach',
    icon: '🎯',
    label: t('home.toolsCoach'),
    whenToUse: t('home.toolsCoachWhen'),
    badge: t('home.toolsGoalCount', {count: activeGoalCount}),
    badgeOk: activeGoalCount > 0,
    emphasized: recommendedToolsBarId === 'coach',
  };

  const toolById: Record<ToolsBarToolId, ToolItem> = {
    morning: morningTool,
    evening: eveningTool,
    coach: coachTool,
  };
  const tools: ToolItem[] = toolOrder.map((id) => toolById[id]);

  return (
    <div>
      <p className="mb-3 text-xs font-semibold txt-muted">
        {t('home.toolsWhenTitle')}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {tools.map(({href, icon, label, whenToUse, badge, badgeOk, emphasized}) => {
        const cls = `focus-ring group flex flex-col items-center gap-2 rounded-[16px] py-4 px-2 text-center transition ${
          emphasized
            ? 'bg-[var(--blue)]/8 hover:bg-[var(--blue)]/12'
            : 'fill-1 hover:fill-2'
        }`;
        const inner = (
          <>
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-xs font-bold txt-soft group-hover:txt-strong leading-tight">
              {label}
            </span>
            <span className="text-[11px] leading-4 txt-muted">{whenToUse}</span>
            <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
              badgeOk
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'fill-2 txt-muted'
            }`}>
              {badge}
            </span>
          </>
        );

        if (href.startsWith('/#')) {
          return <a key={href} href={href.slice(1)} className={cls}>{inner}</a>;
        }
        return (
          <Link
            key={href}
            href={href as '/' | '/morning-priming' | '/life-coach' | '/evening-reset'}
            className={cls}
          >
            {inner}
          </Link>
        );
      })}
      </div>
    </div>
  );
}
