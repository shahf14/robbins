'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {formulationApi} from '@/lib/life-coach/api-client';
import {
  AVAILABLE_TIME_OPTIONS,
  INTENSITY_PREFERENCES,
  type AvailableTimePerDay,
  type IntensityPreference,
} from '@/lib/life-coach/types';
import {
  COACHING_STYLES,
  PREFERRED_ACTION_WINDOWS,
  saveUserPreferences,
  type CoachingStyle,
  type PreferredActionWindow,
} from '@/lib/user-preferences';
import {
  dismissProfilePrompt,
  isProfilePromptAvailable,
  markProfilePromptAnswered,
  type ProfileCompletionPromptKey,
} from '@/lib/profile-completion';
import {useToast} from '@/components/feedback/toast-provider';

type PromptOption = {
  value: string;
  label: string;
};

type PromptConfig = {
  key: ProfileCompletionPromptKey;
  options: PromptOption[];
  save: (value: string) => Promise<void>;
};

function isAvailableTime(value: string): value is `${AvailableTimePerDay}` {
  return AVAILABLE_TIME_OPTIONS.map(String).includes(value);
}

function isIntensity(value: string): value is IntensityPreference {
  return (INTENSITY_PREFERENCES as readonly string[]).includes(value);
}

function isActionWindow(value: string): value is PreferredActionWindow {
  return (PREFERRED_ACTION_WINDOWS as readonly string[]).includes(value);
}

function isCoachingStyle(value: string): value is CoachingStyle {
  return (COACHING_STYLES as readonly string[]).includes(value);
}

export function ProfileCompletionPrompt() {
  const t = useTranslations();
  const toast = useToast();
  const [refreshToken, setRefreshToken] = useState(0);
  const [saving, setSaving] = useState(false);

  const prompt = useMemo<PromptConfig | null>(() => {
    void refreshToken;
    const configs: PromptConfig[] = [
      {
        key: 'preferred_action_window',
        options: PREFERRED_ACTION_WINDOWS.map((value) => ({
          value,
          label: t(`onboarding.actionWindow.${value}`),
        })),
        save: async (value) => {
          if (!isActionWindow(value)) return;
          saveUserPreferences({preferred_action_window: value});
          await formulationApi.updateParticipantProfile({preferred_action_window: value});
        },
      },
      {
        key: 'coaching_style',
        options: COACHING_STYLES.map((value) => ({
          value,
          label: t(`settings.coachingStyleOption.${value}`),
        })),
        save: async (value) => {
          if (!isCoachingStyle(value)) return;
          saveUserPreferences({coaching_style: value});
          await formulationApi.updateParticipantProfile({coaching_style: value});
        },
      },
      {
        key: 'available_time_per_day',
        options: AVAILABLE_TIME_OPTIONS.map((value) => ({
          value: String(value),
          label: t('onboarding.availableTimeOption', {mins: value}),
        })),
        save: async (value) => {
          if (!isAvailableTime(value)) return;
          saveUserPreferences({available_time_per_day: Number(value) as AvailableTimePerDay});
        },
      },
      {
        key: 'intensity_preference',
        options: INTENSITY_PREFERENCES.map((value) => ({
          value,
          label: t(`onboarding.intensity.${value}`),
        })),
        save: async (value) => {
          if (!isIntensity(value)) return;
          saveUserPreferences({intensity_preference: value});
        },
      },
    ];

    return configs.find((config) => isProfilePromptAvailable(config.key)) ?? null;
  }, [refreshToken, t]);

  if (!prompt) return null;

  async function answer(value: string) {
    if (!prompt || saving) return;
    setSaving(true);
    try {
      await prompt.save(value);
      markProfilePromptAnswered(prompt.key);
      toast.success(t('feedback.saved'));
      setRefreshToken((current) => current + 1);
    } catch {
      toast.error(t('feedback.failed'));
    } finally {
      setSaving(false);
    }
  }

  function dismiss(days: number) {
    if (!prompt) return;
    dismissProfilePrompt(prompt.key, days);
    setRefreshToken((current) => current + 1);
  }

  return (
    <section className="rounded-[18px] border border-[color:var(--color-border)] fill-1 px-4 py-4 sm:px-5" aria-label={t('home.profileCompletion.aria')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black txt-strong">{t('home.profileCompletion.title')}</p>
          <p className="mt-1 text-sm leading-6 txt-muted">
            {t(`home.profileCompletion.prompts.${prompt.key}`)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="focus-ring rounded-full px-3 py-1.5 text-xs font-bold txt-muted hover:txt-soft"
            onClick={() => dismiss(1)}
          >
            {t('home.profileCompletion.later')}
          </button>
          <button
            type="button"
            className="focus-ring rounded-full px-3 py-1.5 text-xs font-bold txt-muted hover:txt-soft"
            onClick={() => dismiss(7)}
          >
            {t('home.profileCompletion.hideWeek')}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {prompt.options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={saving}
            className="focus-ring rounded-full border border-[color:var(--color-border)] fill-2 px-3 py-2 text-sm font-bold txt-soft transition hover:border-[color:var(--color-border-strong)] hover:txt-strong disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void answer(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
