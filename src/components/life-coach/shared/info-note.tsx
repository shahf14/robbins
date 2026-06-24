'use client';

import {useTranslations} from 'next-intl';

export type InfoNoteVariant = 'default' | 'info' | 'warning';
export type InfoNoteLayout = 'stacked' | 'inline' | 'plain';

type InfoNoteProps = {
  bodyKey: string;
  titleKey?: string;
  detailKey?: string;
  bodyValues?: Record<string, string | number>;
  detailValues?: Record<string, string | number>;
  variant?: InfoNoteVariant;
  layout?: InfoNoteLayout;
  className?: string;
  id?: string;
};

const SHELL_CLASS: Record<InfoNoteVariant, string> = {
  default: 'rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3',
  info: 'rounded-xl border border-[var(--blue)]/30 bg-[linear-gradient(135deg,rgba(26,109,255,0.12),rgba(26,109,255,0.04))] px-4 py-3',
  warning: 'rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3',
};

export function InfoNote({
  bodyKey,
  titleKey,
  detailKey,
  bodyValues,
  detailValues,
  variant = 'default',
  layout = 'stacked',
  className = '',
  id,
}: InfoNoteProps) {
  const t = useTranslations();
  const body = t(bodyKey, bodyValues);
  const detail = detailKey ? t(detailKey, detailValues) : null;

  if (layout === 'plain') {
    return (
      <p className={className} id={id}>
        {titleKey ? (
          <>
            <span className="font-semibold txt-soft">{t(titleKey)}: </span>
            {body}
          </>
        ) : (
          body
        )}
      </p>
    );
  }

  if (layout === 'inline') {
    return (
      <p
        id={id}
        role="note"
        className={`${SHELL_CLASS.default} text-sm leading-6 txt-soft ${className}`.trim()}
      >
        {titleKey ? (
          <>
            <span className="font-semibold txt-soft">{t(titleKey)}: </span>
            {body}
          </>
        ) : (
          body
        )}
      </p>
    );
  }

  const titleClass =
    variant === 'warning'
      ? 'text-xs font-bold uppercase tracking-wide text-amber-200/90'
      : variant === 'info'
        ? 'text-xs font-bold uppercase tracking-wide text-[var(--blue)]'
        : 'text-xs font-bold uppercase tracking-wide txt-muted';

  const bodyClass =
    variant === 'warning'
      ? 'mt-1.5 text-sm leading-6 text-amber-50/85'
      : 'mt-1.5 text-sm leading-6 txt-strong';

  const detailClass =
    variant === 'warning'
      ? 'mt-2 text-xs leading-5 text-amber-100/60'
      : 'mt-1 text-xs leading-5 txt-muted';

  return (
    <div id={id} className={`${SHELL_CLASS[variant]} ${className}`.trim()} role="note">
      {titleKey ? <p className={titleClass}>{t(titleKey)}</p> : null}
      <p className={titleKey ? bodyClass : 'text-sm leading-6 txt-strong'}>{body}</p>
      {detail ? <p className={detailClass}>{detail}</p> : null}
    </div>
  );
}
