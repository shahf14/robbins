'use client';

import {useEffect} from 'react';
import type {ReactNode} from 'react';

/**
 * Full-screen celebration moment shown right after a goal is saved — the peak
 * of the onboarding flow. Lightweight CSS confetti, no dependencies.
 */
export function GoalCelebration({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  // Lock background scroll while the overlay is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const colors = ['#1a6dff', '#22c55e', '#f59e0b', '#ec4899', '#a855f7', '#ffffff'];
  const pieces = Array.from({length: 60}, (_, i) => ({
    id: i,
    left: seededFraction(i, 17) * 100,
    delay: seededFraction(i, 31) * 0.6,
    duration: 2.4 + seededFraction(i, 47) * 1.8,
    color: colors[i % colors.length],
    size: 6 + seededFraction(i, 61) * 6,
    rotate: seededFraction(i, 79) * 360,
  }));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="goal-celebration-title">
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {pieces.map((p) => (
          <span
            key={p.id}
            className="absolute -top-4 block rounded-[2px]"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * 1.6}px`,
              backgroundColor: p.color,
              transform: `rotate(${p.rotate}deg)`,
              animation: `goal-confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
            }}
          />
        ))}
      </div>

      <div className="relative mx-4 w-full max-w-md rounded-[28px] border border-white/10 bg-[#0b1220] p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(34,197,94,0.14)]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h3 id="goal-celebration-title" className="mt-6 text-2xl font-black text-white">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p>
        {children && <div className="mt-7 grid gap-3">{children}</div>}
      </div>

      <style>{`
        @keyframes goal-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function seededFraction(index: number, salt: number) {
  return ((index * salt + salt * 7) % 101) / 101;
}
