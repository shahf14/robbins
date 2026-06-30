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
import {
  loadDomainStepFilter,
  saveDomainStepFilter,
} from '@/lib/life-coach/domain-step-filter-storage';
import type {LifeDomain} from '@/lib/life-coach/types';

type Options = {
  fallbackTab: DomainDetailTab;
  /** When true, writes fallback tab into the URL once if `tab` is missing. */
  ready?: boolean;
  defaultStepFilter?: StepStatusFilter;
  includeStepFilter?: boolean;
  /** When set, step filter is remembered per domain when `steps` is absent from the URL. */
  domain?: LifeDomain;
};

export function useDomainDetailUrlState({
  fallbackTab,
  ready = true,
  defaultStepFilter = 'pending',
  includeStepFilter = true,
  domain,
}: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bootstrappedRef = useRef(false);

  const tabParam = searchParams.get('tab');
  const stepsParam = includeStepFilter ? searchParams.get('steps') : null;
  const parsedTab = parseDomainDetailTab(tabParam);
  const parsedSteps = includeStepFilter ? parseDomainStepFilter(stepsParam) : null;
  const activeTab = parsedTab ?? fallbackTab;
  const persistedStepFilter =
    includeStepFilter && domain && stepsParam === null ? loadDomainStepFilter(domain) : null;
  const stepFilter = parsedSteps ?? persistedStepFilter ?? defaultStepFilter;

  useEffect(() => {
    if (!ready) return;
    const invalidTab = tabParam !== null && parsedTab === null;
    const invalidSteps = includeStepFilter && stepsParam !== null && parsedSteps === null;
    if (!invalidTab && !invalidSteps) return;
    const params = new URLSearchParams(searchParams.toString());
    if (invalidTab) params.delete('tab');
    if (invalidSteps) params.delete('steps');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {scroll: false});
  }, [
    ready,
    tabParam,
    stepsParam,
    parsedTab,
    parsedSteps,
    includeStepFilter,
    pathname,
    router,
    searchParams,
  ]);

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
      if (domain) saveDomainStepFilter(domain, filter);
      router.push(buildDomainDetailHref(pathname, searchParams, {steps: filter}), {
        scroll: false,
      });
    },
    [domain, includeStepFilter, pathname, router, searchParams]
  );

  return {activeTab, stepFilter, setActiveTab, setStepFilter};
}
