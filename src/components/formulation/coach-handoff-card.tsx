'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {formulationApi} from '@/lib/life-coach/api-client';
import {buildPersonalizedChallenge} from '@/lib/formulation/personalized-challenge';
import type {FormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import {PersonalizedChallengeCard} from '@/components/formulation/personalized-challenge-card';
import type {AppLocale} from '@/i18n/config';

export function CoachHandoffCard() {
  const t = useTranslations('formulation.handoff');
  const locale = useLocale() as AppLocale;
  const [session, setSession] = useState<FormulationSessionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    formulationApi.getLatest()
      .then(({completed}) => { if (!cancelled) setSession(completed); })
      .catch(() => { /* best-effort: non-critical */ });
    return () => { cancelled = true; };
  }, []);

  if (!session?.formulation_approved || !session.coach_handoff) {
    return null;
  }

  const f = session.formulation_approved;
  const h = session.coach_handoff;
  const challenge = buildPersonalizedChallenge(session, locale);

  return (
    <section className="panel-surface grid gap-4 p-6">
      <p className="eyebrow">{t('title')}</p>
      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="txt-muted">{t('concern')}</dt>
          <dd className="font-semibold txt-strong">{f.presenting_concern_user_words}</dd>
        </div>
        {f.maintaining_factors.length > 0 && (
          <div>
            <dt className="txt-muted">{t('maintaining')}</dt>
            <dd className="txt-strong">{f.maintaining_factors.join(' · ')}</dd>
          </div>
        )}
        {f.existing_strengths.length > 0 && (
          <div>
            <dt className="txt-muted">{t('strengths')}</dt>
            <dd className="txt-strong">{f.existing_strengths.join(' · ')}</dd>
          </div>
        )}
        <div>
          <dt className="txt-muted">{t('value')}</dt>
          <dd className="txt-strong">{h.value}</dd>
        </div>
        <div>
          <dt className="txt-muted">{t('microGoal')}</dt>
          <dd className="font-semibold txt-strong">{h.micro_goal_week}</dd>
        </div>
        {h.do_not_touch.length > 0 && (
          <div>
            <dt className="txt-muted">{t('doNotTouch')}</dt>
            <dd className="txt-strong">{h.do_not_touch.join(' · ')}</dd>
          </div>
        )}
      </dl>
      {challenge && <PersonalizedChallengeCard challenge={challenge} variant="handoff" />}
    </section>
  );
}
