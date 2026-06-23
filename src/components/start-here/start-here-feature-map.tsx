import {NavArrow} from '@/components/directional-arrow';
import {Link} from '@/i18n/navigation';
import {FEATURE_BORDER_COLORS, type StartHereContent} from '@/lib/start-here/content';

type Props = {
  content: StartHereContent;
};

export function StartHereFeatureMap({content}: Props) {
  return (
    <section id="features" className="section-block section-block-tight scroll-mt-24">
      <div className="page-shell">
        <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="field-label mb-0 text-[var(--blue)]" aria-hidden="true">
              {content.mapTitle}
            </p>
            <h2 className="mt-3 text-3xl font-black">{content.mapTitle}</h2>
            <p className="mt-3 leading-8 text-[var(--muted)]">{content.mapBody}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {content.features.map((feature, index) => (
              <Link
                key={feature.title}
                href={feature.href}
                className={`focus-ring interactive-panel flex min-h-[180px] flex-col rounded-[20px] border border-[color:var(--color-border)] border-t-4 fill-1 p-6 transition hover:border-[var(--blue)]/40 hover:shadow-md ${FEATURE_BORDER_COLORS[index % FEATURE_BORDER_COLORS.length]}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {feature.icon}
                  </span>
                  <h3 className="text-lg font-black">{feature.title}</h3>
                </div>
                <p className="mt-2 flex-1 text-sm leading-7 txt-soft">{feature.body}</p>
                <p className="mt-3 rounded-xl fill-1 px-3 py-2 text-xs font-semibold leading-5 txt-muted">
                  {feature.best}
                </p>
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[var(--blue)]">
                  {feature.cta}
                  <NavArrow />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
