'use client';

import {Link} from '@/i18n/navigation';
import type {NextBestAction, NextBestActionType} from '@/lib/next-best-action';

type Props = {
  action: NextBestAction;
  className?: string;
  disabled?: boolean;
  onCustomAction?: (action: NextBestAction) => void;
};

const ROUTE_ACTIONS: Partial<Record<NextBestActionType, string>> = {
  open_life_coach: '/life-coach',
  open_coach: '/coach',
  open_morning_ritual: '/morning-priming',
  generate_daily_steps: '/life-coach',
};

function resolveHref(action: NextBestAction): string | null {
  if (action.action_type === 'complete_daily_step') {
    return action.target_id ? `/life-coach#step-${action.target_id}` : '/life-coach';
  }
  return ROUTE_ACTIONS[action.action_type] ?? null;
}

export function NextBestActionCta({action, className = '', disabled = false, onCustomAction}: Props) {
  const minuteHint =
    action.estimated_minutes != null ? ` · ${action.estimated_minutes}m` : '';

  if (action.action_type === 'save_goal' || action.action_type === 'shrink_tomorrow' ||
      action.action_type === 'change_time' || action.action_type === 'plan_b') {
    if (!onCustomAction) return null;
    return (
      <button
        type="button"
        className={`focus-ring btn-small ${className}`.trim()}
        disabled={disabled}
        aria-busy={disabled}
        onClick={() => {
          if (disabled) return;
          onCustomAction(action);
        }}
      >
        {action.label}
        {minuteHint}
      </button>
    );
  }

  if (onCustomAction && (action.action_type === 'generate_daily_steps' || action.action_type === 'complete_daily_step')) {
    return (
      <button
        type="button"
        className={`focus-ring btn-small ${className}`.trim()}
        disabled={disabled}
        aria-busy={disabled}
        onClick={() => {
          if (disabled) return;
          onCustomAction(action);
        }}
      >
        {action.label}
        {minuteHint}
      </button>
    );
  }

  const href = resolveHref(action);
  if (href) {
    return (
      <Link href={href} className={`focus-ring btn-small ${className}`.trim()}>
        {action.label}
        {minuteHint}
      </Link>
    );
  }

  return null;
}
