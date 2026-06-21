type ArrowProps = {
  className?: string;
};

/** Navigation / CTA — points in the reading direction (LTR →, RTL ←). */
export function NavArrow({className = ''}: ArrowProps) {
  return (
    <svg
      className={`inline-block h-3.5 w-3.5 shrink-0 align-[-0.125em] rtl:-scale-x-100 ${className}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Sequential flow between steps — same direction as NavArrow. */
export function FlowArrow({className = ''}: ArrowProps) {
  return <NavArrow className={className} />;
}

/** Back / previous — opposite of NavArrow. */
export function BackArrow({className = ''}: ArrowProps) {
  return (
    <svg
      className={`inline-block h-3.5 w-3.5 shrink-0 align-[-0.125em] ltr:-scale-x-100 ${className}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Expand / collapse chevron (points down, rotates when open). */
export function ChevronDown({className = '', open = false}: ArrowProps & {open?: boolean}) {
  return (
    <svg
      className={`inline-block h-3.5 w-3.5 shrink-0 align-[-0.125em] transition-transform duration-200 ${
        open ? 'rotate-180' : ''
      } ${className}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
