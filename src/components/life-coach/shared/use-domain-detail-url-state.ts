'use client';

import {useCallback, useEffect, useRef} from 'react';
import {useSearchParams} from 'next/navigation';
import {usePathname, useRouter} from '@/i18n/navigation';
import type {DomainDetailTab} from './domain-detail-tabs';
import type {StepStatusFilter} from '../step-filter-chips';
import {
  buildDomainDetailHref,
  parseDomainDetailTab,
  parseDomainStepFilter,
} from '@/lib/life-coach/domain-detail-url-state';

type Options = {
  fallbackTab: DomainDetailTab;
  /** When true, writes fallback tab into the URL once if `tab` is missing. */
  ready?: boolean;
  defaultStepFilter?: StepStatusFilter;
  includeStepFilter?: boolean;
};

export function useDomainDetailUrlState({
  fallbackTab,
  ready = true,
  defaultStepFilter = 'pending',
  includeStepFilter = true,
}: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bootstrappedRef = useRef(false);

  const tabParam = searchParams.get('tab');
  const stepsParam = includeStepFilter ? searchParams.get('steps') : null;
  const activeTab = parseDomainDetailTab(tabParam) ?? fallbackTab;
  const stepFilter = parseDomainStepFilter(stepsParam) ?? defaultStepFilter;

  useEffect(() => {
    if (!ready || tabParam !== null || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (fallbackTab === 'today') return;
    router.replace(buildDomainDetailHref(pathname, searchParams, {tab: fallbackTab}), {
      scroll: false,
    });
  }, [ready, tabParam, fallbackTab, pathname, router, searchParams]);

  const setActiveTab = useCallback(
    (tab: DomainDetailTab) => {
      router.push(buildDomainDetailHref(pathname, searchParams, {tab}), {scroll: false});
    },
    [pathname, router, searchParams]
  );

  const setStepFilter = useCallback(
    (filter: StepStatusFilter) => {
      if (!includeStepFilter) return;
      router.push(buildDomainDetailHref(pathname, searchParams, {steps: filter}), {
        scroll: false,
      });
    },
    [includeStepFilter, pathname, router, searchParams]
  );

  return {activeTab, stepFilter, setActiveTab, setStepFilter};
}
