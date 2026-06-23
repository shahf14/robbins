'use client';

import {useCallback, useEffect, useState} from 'react';
import type {StartHereContent} from '@/lib/start-here/content';
import {getMasteryChecked, toggleMasteryItem} from '@/lib/start-here/progress';

type Props = {
  content: StartHereContent;
};

export function StartHereMastery({content}: Props) {
  const total = content.mastery.length;
  const [checked, setChecked] = useState<boolean[]>(() => Array(total).fill(false));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = getMasteryChecked();
      setChecked(Array.from({length: total}, (_, i) => stored[i] ?? false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [total]);

  const doneCount = checked.filter(Boolean).length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const progressLabel = content.masteryProgress
    .replace('{done}', String(doneCount))
    .replace('{total}', String(total));

  const handleToggle = useCallback(
    (index: number) => {
      setChecked(toggleMasteryItem(index, total));
    },
    [total]
  );

  return (
    <section id="mastery" className="section-block section-block-tight scroll-mt-24">
      <div className="page-shell">
        <div className="panel-surface-strong p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="field-label mb-0 text-[var(--blue)]" aria-hidden="true">
                {content.masteryTitle}
              </p>
              <h2 className="mt-3 text-3xl font-black">{content.masteryTitle}</h2>
              <p className="mt-3 leading-8 text-[var(--muted)]">{content.masteryBody}</p>
              <p className="mt-4 text-sm font-bold text-[var(--blue)]">{progressLabel}</p>
              <div
                className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={progressLabel}
              >
                <div
                  className="h-full rounded-full bg-[var(--blue)] transition-all"
                  style={{width: `${percent}%`}}
                />
              </div>
            </div>
            <div className="grid gap-3">
              {content.mastery.map((item, index) => (
                <label
                  key={item}
                  className={`flex cursor-pointer gap-3 rounded-2xl border border-[color:var(--color-border)] p-4 transition ${
                    checked[index] ? 'bg-[var(--blue)]/5' : 'fill-1'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked[index]}
                    onChange={() => handleToggle(index)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--blue)]"
                  />
                  <span
                    className={`text-sm font-semibold leading-7 ${
                      checked[index] ? 'txt-muted line-through' : 'txt-soft'
                    }`}
                  >
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
