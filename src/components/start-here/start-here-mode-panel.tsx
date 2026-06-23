'use client';

import {Link} from '@/i18n/navigation';
import {useCallback, useEffect, useState} from 'react';
import {
  MODE_ACCENT,
  type ModeConfig,
  type StartHereContent,
  type StartMode,
} from '@/lib/start-here/content';
import {
  getCompletedStepIndices,
  getPathProgressPercent,
  markAllPathSteps,
  togglePathStep,
} from '@/lib/start-here/progress';

type Props = {
  content: StartHereContent;
  mode: StartMode;
  onModeChange: (mode: StartMode) => void;
};

export function StartHereModePanel({content, mode, onModeChange}: Props) {
  const activeMode = content.modes[mode];
  const accent = MODE_ACCENT[mode];
  const totalSteps = activeMode.plan.length;

  const [completed, setCompleted] = useState<number[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCompleted(getCompletedStepIndices(mode));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [mode]);

  const percent = getPathProgressPercent(mode, totalSteps);
  const doneCount = completed.length;
  const progressText = content.progressLabel
    .replace('{done}', String(doneCount))
    .replace('{total}', String(totalSteps));

  const handleToggleStep = useCallback(
    (index: number) => {
      setCompleted(togglePathStep(mode, index, totalSteps));
    },
    [mode, totalSteps]
  );

  const handleCtaClick = useCallback(() => {
    setCompleted(markAllPathSteps(mode, totalSteps));
  }, [mode, totalSteps]);

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--blue)]">
        {content.modesTitle}
      </p>
      <div className="mt-4 grid gap-2">
        {(Object.keys(content.modes) as StartMode[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => onModeChange(key)}
            className={`focus-ring rounded-2xl border px-4 py-3 text-start transition ${
              mode === key
                ? `${MODE_ACCENT[key].border} bg-white/8 text-white`
                : 'border-white/10 bg-white/3 text-white/62 hover:border-white/20 hover:text-white'
            }`}
          >
            <span className="text-sm font-black">{content.modes[key].label}</span>
          </button>
        ))}
      </div>

      <div
        key={mode}
        className={`mt-5 rounded-2xl border bg-white/4 p-5 transition-opacity duration-300 ${accent.border}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-black">{activeMode.title}</h2>
          <span className="text-xs font-bold text-white/70">{progressText}</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={progressText}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${accent.bar}`}
            style={{width: `${percent}%`}}
            aria-hidden="true"
          />
        </div>
        <p className="mt-4 text-sm leading-7 text-white/62">{activeMode.body}</p>
        <ol className="mt-4 grid gap-2">
          {activeMode.plan.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-6 text-white/78">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={completed.includes(index)}
                  onChange={() => handleToggleStep(index)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 accent-[var(--blue)]"
                />
                <span className={completed.includes(index) ? 'text-white/45 line-through' : ''}>
                  {step}
                </span>
              </label>
            </li>
          ))}
        </ol>
        <Link
          href={activeMode.href}
          onClick={handleCtaClick}
          className="focus-ring btn-primary mt-5 w-full"
        >
          {activeMode.cta}
        </Link>
      </div>
    </div>
  );
}
