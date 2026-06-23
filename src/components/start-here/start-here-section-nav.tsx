'use client';

import {useCallback, useEffect, useState} from 'react';
import type {StartHereContent} from '@/lib/start-here/content';

export type SectionId = 'rhythm' | 'features' | 'guides' | 'mastery';

type Props = {
  content: StartHereContent;
};

const SECTIONS: SectionId[] = ['rhythm', 'features', 'guides', 'mastery'];

export function StartHereSectionNav({content}: Props) {
  const [active, setActive] = useState<SectionId>('rhythm');

  const labels: Record<SectionId, string> = {
    rhythm: content.navRhythm,
    features: content.navFeatures,
    guides: content.navGuides,
    mastery: content.navMastery,
  };

  const scrollTo = useCallback((id: SectionId) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'start'});
      setActive(id);
    }
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    for (const id of SECTIONS) {
      const el = document.getElementById(id);
      if (!el) continue;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActive(id);
            }
          }
        },
        {rootMargin: '-88px 0px -55% 0px', threshold: 0}
      );

      observer.observe(el);
      observers.push(observer);
    }

    return () => {
      for (const observer of observers) {
        observer.disconnect();
      }
    };
  }, []);

  return (
    <nav
      aria-label={content.navRhythm}
      className="sticky top-[72px] z-20 border-b border-[color:var(--color-border)] fill-1 backdrop-blur-xl"
    >
      <div className="page-shell flex gap-1 overflow-x-auto py-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className={`focus-ring shrink-0 snap-start rounded-full px-4 py-2 text-sm font-bold transition ${
              active === id
                ? 'bg-[var(--blue)]/20 text-[var(--blue)]'
                : 'txt-muted hover:fill-2 hover:txt-strong'
            }`}
          >
            {labels[id]}
          </button>
        ))}
      </div>
    </nav>
  );
}
