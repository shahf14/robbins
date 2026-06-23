import {NavArrow} from '@/components/directional-arrow';
import {Link} from '@/i18n/navigation';
import type {StartHereContent} from '@/lib/start-here/content';

type Props = {
  content: StartHereContent;
};

export function StartHereRhythm({content}: Props) {
  return (
    <section id="rhythm" className="section-block section-block-tight scroll-mt-24">
      <div className="page-shell">
        <div className="max-w-3xl">
          <p className="eyebrow">{content.rhythmEyebrow}</p>
          <h2 className="mt-3 text-3xl font-black">{content.rhythmTitle}</h2>
          <p className="mt-3 leading-8 text-[var(--muted)]">{content.rhythmBody}</p>
        </div>
        <div className="mt-7 grid gap-3">
          {content.rhythm.map((item, index) => (
            <div
              key={item.title}
              className="grid gap-4 rounded-[22px] border border-[color:var(--color-border)] fill-1 p-5 transition hover:border-[var(--blue)]/30 md:grid-cols-[90px_1fr_auto] md:items-center"
            >
              <span className="text-3xl font-black txt-faint tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--blue)]/75">
                  {item.time}
                </p>
                <h3 className="mt-1 text-xl font-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 txt-soft">{item.body}</p>
              </div>
              <Link
                href={item.href}
                className="focus-ring btn-small inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                aria-label={`${content.rhythmOpenNow}: ${item.title}`}
              >
                {content.rhythmOpenNow}
                <NavArrow />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
