'use client';

type Props = {
  headline: string;
  detailLines?: string[];
  className?: string;
};

export function BehaviorChangeInsightCard({headline, detailLines = [], className = ''}: Props) {
  return (
    <div
      className={`rounded-[20px] border border-violet-400/20 bg-violet-500/6 px-5 py-4 ${className}`.trim()}
    >
      <p className="text-sm font-semibold leading-7 text-violet-100/95">{headline}</p>
      {detailLines.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs leading-5 text-white/50">
          {detailLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
