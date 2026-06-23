'use client';

import {ChevronDown} from '@/components/directional-arrow';
import type {StartHereContent} from '@/lib/start-here/content';

type Props = {
  content: StartHereContent;
};

function AccordionPanel({
  title,
  items,
  tapHint,
}: {
  title: string;
  items: Array<{title: string; body: string}>;
  tapHint: string;
}) {
  return (
    <section className="panel-surface p-6 sm:p-8">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-5 grid gap-3">
        {items.map((item, index) => (
          <AccordionItem key={item.title} item={item} showHint={index === 0} tapHint={tapHint} />
        ))}
      </div>
    </section>
  );
}

function AccordionItem({
  item,
  showHint,
  tapHint,
}: {
  item: {title: string; body: string};
  showHint: boolean;
  tapHint: string;
}) {
  return (
    <details className="group rounded-[18px] border border-[color:var(--color-border)] fill-1 open:border-[var(--blue)]/30 open:bg-[var(--blue)]/5">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black marker:hidden">
        <span className="flex flex-col gap-0.5">
          <span>{item.title}</span>
          {showHint && (
            <span className="text-xs font-normal txt-faint group-open:hidden">{tapHint}</span>
          )}
        </span>
        <ChevronDown className="text-[var(--blue)] transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="px-5 pb-4 text-sm leading-7 txt-soft">{item.body}</p>
    </details>
  );
}

export function StartHereAccordions({content}: Props) {
  return (
    <section id="guides" className="section-block section-block-tight scroll-mt-24">
      <div className="page-shell grid gap-4 lg:grid-cols-2">
        <AccordionPanel
          title={content.principlesTitle}
          items={content.principles}
          tapHint={content.accordionTapHint}
        />
        <AccordionPanel
          title={content.playbookTitle}
          items={content.playbook}
          tapHint={content.accordionTapHint}
        />
      </div>
    </section>
  );
}
