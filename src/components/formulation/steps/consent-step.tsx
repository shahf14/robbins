'use client';

import {useEffect, useState} from 'react';
import type {ConsentLiveDraft} from '@/lib/formulation/wizard-live-draft';
import {useTranslations} from 'next-intl';
import {normalizeLifeContextSelection} from '@/lib/formulation/life-context';
import {
  PARTICIPANT_GENDERS,
  normalizeParticipantAge,
  type ParticipantGender,
  type ParticipantProfileLocks,
} from '@/lib/formulation/participant-profile';
import {LIFE_CONTEXT_STATUSES, type LifeContextStatus} from '@/lib/life-coach/types';

type Props = {
  loading: boolean;
  locks: ParticipantProfileLocks;
  initial: {
    life_context_statuses: LifeContextStatus[];
    life_context_status_note?: string;
    gender: ParticipantGender | null;
    age: number | null;
  };
  onDraftChange?: (draft: ConsentLiveDraft) => void;
  onSubmit: (input: {
    life_context_statuses: LifeContextStatus[];
    life_context_status_note?: string;
    gender: ParticipantGender;
    age: number | null;
    boundaries_ack: {can_stop: boolean; can_skip: boolean; can_edit_summary: boolean};
  }) => void;
};

function LockedValue({label, value, hint}: {label: string; value: string; hint?: string}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3">
      <p className="text-xs txt-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold txt-strong">{value}</p>
      {hint ? <p className="mt-1 text-[10px] txt-faint">{hint}</p> : null}
    </div>
  );
}

export function ConsentStep({loading, locks, initial, onDraftChange, onSubmit}: Props) {
  const t = useTranslations('formulation');
  const [selected, setSelected] = useState<LifeContextStatus[]>(initial.life_context_statuses);
  const [note, setNote] = useState(initial.life_context_status_note ?? '');
  const [gender, setGender] = useState<ParticipantGender | null>(initial.gender);
  const [age, setAge] = useState<string>(
    initial.age != null ? String(initial.age) : ''
  );

  function toggle(status: LifeContextStatus) {
    if (locks.life_context_statuses) return;
    setSelected((current) => {
      if (status === 'prefer_not') {
        return current.includes('prefer_not') ? [] : ['prefer_not'];
      }
      const withoutPrefer = current.filter((s) => s !== 'prefer_not');
      return withoutPrefer.includes(status)
        ? withoutPrefer.filter((s) => s !== status)
        : [...withoutPrefer, status];
    });
  }

  const normalized = normalizeLifeContextSelection(selected);
  const showOtherNote = normalized.includes('other') && !locks.life_context_statuses;
  const parsedAge = normalizeParticipantAge(age);

  useEffect(() => {
    const contexts = normalizeLifeContextSelection(selected);
    const showNote = contexts.includes('other') && !locks.life_context_statuses;
    onDraftChange?.({
      life_context_statuses: contexts,
      life_context_status_note: showNote ? note : undefined,
      gender,
      age: parsedAge,
    });
  }, [selected, note, gender, age, parsedAge, locks.life_context_statuses, onDraftChange]);

  const profileComplete =
    normalized.length > 0 &&
    gender != null &&
    parsedAge != null;

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-xl font-black txt-strong">{t('consent.title')}</h2>
        <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)]">{t('consent.intro')}</p>
      </div>

      <div className="grid gap-6 rounded-[20px] border border-[color:var(--color-border)] fill-1 p-5 sm:p-6">
      <div className="grid gap-2">
        <span className="field-label mb-0">{t('consent.lifeContext')}</span>
        <p className="text-xs txt-muted">{t('consent.lifeContextMulti')}</p>
        {locks.life_context_statuses ? (
          <LockedValue
            label={t('consent.lifeContext')}
            value={normalized.map((s) => t(`consent.contexts.${s}`)).join(' · ')}
            hint={t('consent.lockedFromSettings')}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {LIFE_CONTEXT_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={selected.includes(status)}
                  className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selected.includes(status)
                      ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                      : 'border-[color:var(--color-border)] fill-1 txt-soft'
                  }`}
                  onClick={() => toggle(status)}
                >
                  {t(`consent.contexts.${status}`)}
                </button>
              ))}
            </div>
            {showOtherNote && (
              <input
                className="focus-ring input-base"
                value={note}
                aria-label={t('consent.otherPlaceholder')}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('consent.otherPlaceholder')}
              />
            )}
          </>
        )}
      </div>

      <div className="grid gap-2">
        <span className="field-label mb-0">{t('consent.gender')}</span>
        {locks.gender && gender ? (
          <LockedValue
            label={t('consent.gender')}
            value={t(`consent.genderOptions.${gender}`)}
            hint={t('consent.lockedFromSettings')}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {PARTICIPANT_GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={gender === g}
                className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  gender === g
                    ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                    : 'border-[color:var(--color-border)] fill-1 txt-soft'
                }`}
                onClick={() => setGender(g)}
              >
                {t(`consent.genderOptions.${g}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <span className="field-label mb-0">{t('consent.age')}</span>
        {locks.age ? (
          <LockedValue
            label={t('consent.age')}
            value={parsedAge != null ? String(parsedAge) : '—'}
            hint={t('consent.lockedFromSettings')}
          />
        ) : (
          <input
            className="focus-ring input-base w-32"
            type="number"
            inputMode="numeric"
            min={16}
            max={120}
            value={age}
            aria-label={t('consent.age')}
            onChange={(e) => setAge(e.target.value)}
            placeholder={t('consent.agePlaceholder')}
          />
        )}
      </div>

      <button
        className="focus-ring btn-primary w-full"
        type="button"
        disabled={loading || !profileComplete}
        aria-busy={loading}
        onClick={() => {
          if (!gender) return;
          onSubmit({
            life_context_statuses: normalized,
            life_context_status_note: showOtherNote ? note : undefined,
            gender,
            age: parsedAge,
            boundaries_ack: {can_stop: true, can_skip: true, can_edit_summary: true},
          });
        }}
      >
        {loading ? t('saving') : t('consent.accept')}
      </button>
      </div>
    </div>
  );
}
