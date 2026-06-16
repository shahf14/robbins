'use client';

import {type CSSProperties, useCallback, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {LifeDomain} from '@/lib/life-coach/types';
import {
  getLifeWheelBandColor,
  getLifeWheelRatingKeys,
  getLifeWheelThumbPercent,
} from '@/lib/life-wheel';

type Props = {
  domain: LifeDomain;
  icon?: string;
  label: string;
  score: number;
  onChange: (score: number) => void;
  hideLabel?: boolean;
};

export function LifeWheelSlider({domain, icon, label, score, onChange, hideLabel = false}: Props) {
  const t = useTranslations();
  const [dragging, setDragging] = useState(false);
  const rating = getLifeWheelRatingKeys(domain, score);
  const color = getLifeWheelBandColor(score);
  const thumbPercent = getLifeWheelThumbPercent(score);
  const bandLabel = t(rating.bandLabelKey);
  const description = t(rating.descriptionKey);
  const stopDragging = useCallback(() => setDragging(false), []);

  return (
    <div className="grid gap-3">
      {!hideLabel && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-white/80">
            {icon ? <span aria-hidden="true">{icon}</span> : null}
            {label}
          </span>
        </div>
      )}

      <div className="relative pt-16 sm:pt-14">
        <div
          className={`pointer-events-none absolute top-1 z-10 min-w-[5.2rem] -translate-x-1/2 rounded-xl bg-[#18181b] px-3 py-2 text-center shadow-xl ring-1 ring-white/10 transition duration-200 ${
            dragging ? 'scale-105 opacity-100 ring-white/18' : 'scale-100 opacity-85'
          }`}
          style={{left: `clamp(2.75rem, ${thumbPercent}%, calc(100% - 2.75rem))`}}
          role="tooltip"
        >
          <p className="text-xs font-bold tabular-nums text-white">{rating.score}/10</p>
          <p className="text-xs font-semibold" style={{color}}>
            {bandLabel}
          </p>
        </div>

        <div className="relative h-11">
          <div className="pointer-events-none absolute inset-x-3 top-1/2 z-30 grid -translate-y-1/2 grid-cols-10">
            {Array.from({length: 10}).map((_, index) => (
              <span
                key={`dot-${index}`}
                className={`h-1.5 w-1.5 justify-self-center rounded-full transition-colors ${
                  index + 1 <= rating.score ? 'bg-white/70' : 'bg-white/22'
                }`}
              />
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={score}
            aria-label={label}
            aria-valuenow={score}
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuetext={`${rating.score}/10 – ${bandLabel}. ${description}`}
            onChange={(event) => onChange(Number(event.target.value))}
            onPointerDown={() => setDragging(true)}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onBlur={stopDragging}
            onTouchEnd={stopDragging}
            className="life-wheel-range focus-ring absolute inset-x-0 top-0 z-20 w-full"
            style={{
              '--life-wheel-progress': `${thumbPercent}%`,
              '--life-wheel-color': color,
            } as CSSProperties}
          />
        </div>
      </div>

      <div
        key={`${domain}-${rating.bandId}-${rating.score}`}
        className="life-wheel-feedback min-h-[4.5rem] rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 transition-colors duration-300"
      >
        <p className="text-sm font-semibold text-white/85">
          <span className="tabular-nums">{rating.score}/10</span>
          <span className="text-white/35"> · </span>
          <span style={{color}}>{bandLabel}</span>
        </p>
        <p className="mt-1 line-clamp-3 text-sm leading-6 text-white/50">{description}</p>
      </div>
    </div>
  );
}
