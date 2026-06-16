'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/config';
import {
  askVirtualCoach,
  COACH_EMOTIONS,
  type CoachEmotion,
} from '@/lib/coach/client';
import {coachStateByTag} from '@/lib/coach/prefill';
import type {CheckInTag} from '@/lib/check-in-types';
import {BusyButton} from '@/components/feedback/busy-button';
import {NextBestActionCta} from '@/components/next-best-action/next-best-action-cta';
import type {NextBestAction} from '@/lib/next-best-action';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import type {DailyFocusContext} from '@/lib/daily-focus-context';

export function VirtualCoachPanel() {
  const t = useTranslations('coach');
  const locale = useLocale() as AppLocale;
  const [emotion, setEmotion] = useState<CoachEmotion>('overwhelmed');
  const [escape, setEscape] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [userText, setUserText] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [source, setSource] = useState<'openai' | 'local_fallback' | 'personalized_fallback' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [nextAction, setNextAction] = useState<NextBestAction | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [dailyFocus, setDailyFocus] = useState<DailyFocusContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const focusResult = await lifeCoachApi.getDailyFocus().catch(() => ({dailyFocus: null}));
      if (cancelled) return;
      setDailyFocus(focusResult.dailyFocus);

      const ritual = focusResult.dailyFocus?.latestMorningRitual;
      if (ritual?.primaryTag) {
        const mapped = coachStateByTag[ritual.primaryTag as CheckInTag];
        if (mapped && COACH_EMOTIONS.includes(mapped as CoachEmotion)) {
          setEmotion(mapped as CoachEmotion);
        }
      }
      if (ritual?.focus != null) {
        setEscape(Math.max(1, Math.min(10, 11 - ritual.focus)));
      }
      if (ritual?.energy != null) {
        setEnergy(ritual.energy);
      }
      if (ritual?.priorityAction) {
        setUserText(ritual.priorityAction);
        setPrefilled(true);
        return;
      }

      const focusText = focusResult.dailyFocus?.suggestedAction?.title ?? focusResult.dailyFocus?.morningMission;
      if (focusText) {
        setUserText(
          locale === 'he'
            ? `אני תקוע עם הפוקוס של היום: ${focusText}`
            : `I am stuck with today’s focus: ${focusText}`
        );
        setPrefilled(true);
      }
    })();
    return () => {
      cancelled = true;
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, [locale]);

  async function handleSubmit(textOverride?: string) {
    const text = (textOverride ?? userText).trim();
    if (!text) {
      setError(t('page.truthRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setResponse(null);
    setSource(null);
    setNextAction(null);

    try {
      const result = await askVirtualCoach({
        language: locale,
        tone: 'tony_coach',
        emotionalState: emotion,
        escape,
        energy,
        userText: text,
      });
      setResponse(result.response);
      setSource(result.source);
      setNextAction(result.next_best_action ?? null);
    } catch (err) {
      setError(t('error'));
      if (err instanceof Error && err.message) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyResetTimeoutRef.current = null;
      }, 2000);
    } catch {
      /* ignore */
    }
  }

  const quickActions: Array<{
    key: 'buildStep' | 'shortVersion' | 'stuck' | 'whyItMatters' | 'breakGoal';
    emotion: CoachEmotion;
    energy?: number;
    escape?: number;
  }> = [
    {key: 'buildStep', emotion: 'driven'},
    {key: 'shortVersion', emotion: 'overwhelmed', energy: Math.min(energy, 4), escape: Math.max(escape, 7)},
    {key: 'stuck', emotion: 'avoidant', escape: Math.max(escape, 8)},
    {key: 'whyItMatters', emotion: 'flat', energy: Math.min(energy, 5)},
    {key: 'breakGoal', emotion: 'confused'},
  ];

  function handleQuickAction(action: (typeof quickActions)[number]) {
    const prompt = t(`quickActions.${action.key}.prompt`);
    setEmotion(action.emotion);
    if (action.energy != null) setEnergy(action.energy);
    if (action.escape != null) setEscape(action.escape);
    setUserText(prompt);
    void handleSubmit(prompt);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <section className="panel-surface p-6 sm:p-8" aria-label={t('page.title')}>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">{t('page.title')}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t('page.subtitle')}</p>

        {prefilled ? (
          <p className="mt-4 rounded-xl border border-sky-400/20 bg-sky-500/6 px-4 py-3 text-sm text-sky-100/80">
            {t('page.prefilledHint')}{' '}
            <Link href="/morning-priming" className="font-semibold text-[var(--blue)] underline-offset-2 hover:underline">
              {t('page.morningRitualLink')}
            </Link>
          </p>
        ) : null}

        {dailyFocus?.suggestedAction || dailyFocus?.morningMission ? (
          <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-500/6 px-4 py-3 text-sm leading-6 text-sky-100/80">
            <p className="font-bold text-sky-100">
              {locale === 'he' ? 'המאמן מסונכרן עם הפוקוס היומי' : 'Coach is synced with today’s focus'}
            </p>
            <p className="mt-1 line-clamp-2">
              {dailyFocus.suggestedAction?.title ?? dailyFocus.morningMission}
            </p>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="field-label mb-2">{t('quickActions.title')}</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="focus-ring rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-[var(--blue)]/40 hover:bg-[var(--blue)]/10 hover:text-white disabled:opacity-50"
                disabled={loading}
                aria-busy={loading}
                onClick={() => handleQuickAction(action)}
              >
                {t(`quickActions.${action.key}.label`)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="field-label mb-2">{t('page.emotionLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {COACH_EMOTIONS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={emotion === key}
                className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  emotion === key
                    ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] text-white'
                    : 'border-white/10 bg-white/3 text-white/55 hover:border-white/20'
                }`}
                onClick={() => setEmotion(key)}
              >
                {t(`emotions.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <ScoreSlider
            label={t('page.escapeLabel')}
            hint={t('page.escapeHint')}
            value={escape}
            onChange={setEscape}
          />
          <ScoreSlider
            label={t('page.energyLabel')}
            hint={t('page.energyHint')}
            value={energy}
            onChange={setEnergy}
          />
        </div>

        <label className="mt-6 block">
          <span className="field-label">{t('page.truthLabel')}</span>
          <textarea
            className="focus-ring textarea-base mt-2 min-h-28"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder={t('page.truthPlaceholder')}
            maxLength={2000}
          />
        </label>

        {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}

        <BusyButton
          type="button"
          className="focus-ring btn-primary mt-6"
          busy={loading}
          busyLabel={t('loading')}
          onClick={() => void handleSubmit()}
        >
          {t('page.submit')}
        </BusyButton>
      </section>

      <section className="panel-surface p-6 sm:p-8" aria-label={t('title')} aria-live="polite" aria-busy={loading}>
        <p className="field-label mb-0 text-white/50" aria-hidden="true">{t('title')}</p>
        {!response ? (
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{t('responsePreview')}</p>
        ) : (
          <>
            {source ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                {source === 'openai' ? t('page.sourceAi') : t('page.sourceLocal')}
              </p>
            ) : null}
            <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/3 p-5 text-sm leading-7 text-white/85">
              {response}
            </div>
            {nextAction ? (
              <div className="mt-4">
                <NextBestActionCta action={nextAction} />
              </div>
            ) : null}
            <button
              type="button"
              className="focus-ring btn-ghost mt-4 text-sm"
              onClick={() => void handleCopy()}
            >
              {copied ? t('copied') : t('copy')}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function ScoreSlider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          className="focus-ring w-full accent-[var(--blue)]"
          aria-valuenow={value}
          aria-valuemin={1}
          aria-valuemax={10}
          aria-valuetext={`${value}/10`}
        />
        <span className="w-8 text-right text-lg font-black tabular-nums text-white" aria-hidden="true">{value}</span>
      </div>
    </label>
  );
}
