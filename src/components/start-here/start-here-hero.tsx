import {Link} from '@/i18n/navigation';
import type {StartHereContent} from '@/lib/start-here/content';

type Props = {
  content: StartHereContent;
};

export function StartHereHero({content}: Props) {
  return (
    <div>
      <p className="eyebrow">{content.eyebrow}</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
        {content.title}
      </h1>
      <p className="mt-5 max-w-3xl text-base leading-8 text-white/70 sm:text-lg">
        {content.intro}
      </p>

      <blockquote className="mt-5 max-w-3xl border-s-[3px] border-[var(--blue)] bg-[var(--blue)]/8 px-4 py-3 text-sm font-semibold leading-7 text-white/80">
        <span className="me-2 opacity-70" aria-hidden="true">
          💡
        </span>
        {content.promise}
      </blockquote>

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-6">
        <div className="flex flex-col gap-1.5">
          <Link href="/" className="focus-ring btn-primary w-full sm:w-auto">
            {content.primaryCta}
          </Link>
          <p className="text-xs text-white/50">{content.primaryCtaHint}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Link href="/life-coach" className="focus-ring btn-ghost w-full sm:w-auto">
            {content.secondaryCta}
          </Link>
          <p className="text-xs text-white/50">{content.secondaryCtaHint}</p>
        </div>
      </div>
    </div>
  );
}
