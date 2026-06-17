'use client';

type Props = {
  label: string;
  hint?: string;
  /** 0–100 when known; omit for indeterminate pulse */
  percent?: number;
};

export function WizardBusyOverlay({label, hint, percent}: Props) {
  const width =
    percent != null ? `${Math.min(100, Math.max(0, percent))}%` : undefined;

  return (
    <div
      className="rounded-xl border border-[var(--blue)]/25 bg-[rgba(26,109,255,0.08)] p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm font-semibold txt-strong">{label}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed txt-muted">{hint}</p> : null}
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full fill-3"
        role="progressbar"
        aria-valuenow={percent ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full bg-[var(--accent)] ${
            percent == null ? 'w-1/3 animate-pulse' : 'transition-all duration-500'
          }`}
          style={width != null ? {width} : undefined}
        />
      </div>
    </div>
  );
}
