'use client';

type Props = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

export function MobileQuickAction({
  label,
  onClick,
  disabled,
  loading,
  loadingLabel,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(9,9,11,0.94)] p-3 backdrop-blur-md sm:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        className="focus-ring btn-primary w-full justify-center disabled:opacity-50"
        onClick={onClick}
        disabled={disabled || loading}
        aria-busy={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"
              aria-hidden
            />
            {loadingLabel ?? label}
          </span>
        ) : (
          label
        )}
      </button>
    </div>
  );
}
