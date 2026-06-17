'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {AffirmationManager, formatAffirmationTag} from '@/components/affirmation-manager';
import type {AppLocale} from '@/i18n/config';
import type {AffirmationItem, AffirmationType} from '@/lib/morning-ritual-types';
import {
  pickMorningAffirmation,
  type MorningAffirmationContext,
} from '@/lib/morning-ritual/affirmation-context';
import {StepNavigation} from '@/components/morning-ritual/morning-ritual-navigation';

type AffirmationStepProps = {
  affirmation: AffirmationItem | null;
  allAffirmations: AffirmationItem[];
  locale: AppLocale;
  affirmationContext: MorningAffirmationContext | null;
  onPickAnother: () => void;
  onPickByType: (type: AffirmationType) => void;
  onPickAffirmation: (item: AffirmationItem | null) => void;
  onNext: () => void;
  onBack: () => void;
  onAffirmationsChange: (items: AffirmationItem[]) => void;
};

export function AffirmationStep({
  affirmation,
  allAffirmations,
  locale,
  affirmationContext,
  onPickAnother,
  onPickByType,
  onPickAffirmation,
  onNext,
  onBack,
  onAffirmationsChange,
}: AffirmationStepProps) {
  const t = useTranslations('morningRitual');
  const [viewType, setViewType] = useState<AffirmationType>(affirmation?.type ?? 'text');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<AffirmationType>('text');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [newTags, setNewTags] = useState('');

  const hasYoutubeAffirmations = allAffirmations.some(
    (a) => a.active && a.language === locale && a.type === 'youtube'
  );
  const activeAffirmation = affirmation && affirmation.type === viewType ? affirmation : null;

  function switchViewType(type: AffirmationType) {
    setViewType(type);
    setActiveTagFilter(null);
    onPickByType(type);
    setShowFocusMode(false);
  }

  function pickByTag(tag: string) {
    const nextTag = activeTagFilter === tag ? null : tag;
    setActiveTagFilter(nextTag);
    setShowFocusMode(false);

    if (!nextTag) {
      onPickByType(viewType);
      return;
    }

    const pool = allAffirmations.filter(
      (item) =>
        item.active &&
        item.language === locale &&
        item.type === viewType &&
        item.tags.some((entry) => entry.toLowerCase() === nextTag.toLowerCase())
    );

    if (pool.length === 0) {
      return;
    }

    if (!affirmationContext) return;
    const next = pickMorningAffirmation(pool, locale, affirmationContext);
    if (next) {
      onPickAffirmation(next);
      setShowFocusMode(false);
    }
  }

  function pickAnotherWithinCurrentFilter() {
    if (!activeTagFilter) {
      onPickAnother();
      return;
    }
    if (!affirmationContext) return;

    const pool = allAffirmations.filter(
      (item) =>
        item.active &&
        item.language === locale &&
        item.type === viewType &&
        item.tags.some((entry) => entry.toLowerCase() === activeTagFilter.toLowerCase()) &&
        item.id !== affirmation?.id
    );
    const next = pickMorningAffirmation(pool, locale, affirmationContext);

    if (!next) {
      const currentTagPool = allAffirmations.filter(
        (item) =>
          item.active &&
          item.language === locale &&
          item.type === viewType &&
          item.tags.some((entry) => entry.toLowerCase() === activeTagFilter.toLowerCase())
      );
      const currentMatch = pickMorningAffirmation(currentTagPool, locale, affirmationContext);
      if (currentMatch) {
        onPickAffirmation(currentMatch);
      }
      return;
    }

    onPickAffirmation(next);
    setShowFocusMode(false);
  }

  function addAffirmation() {
    let youtubeVideoId: string | null = null;
    if (newType === 'youtube' && newYoutubeUrl) {
      const match = newYoutubeUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/);
      youtubeVideoId = match ? match[1] : null;
    }

    const item: AffirmationItem = {
      id: crypto.randomUUID(),
      type: newType,
      title: newTitle.trim(),
      textContent: newContent.trim(),
      youtubeVideoId,
      youtubeUrl: newType === 'youtube' ? newYoutubeUrl.trim() : null,
      tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
      language: locale,
      active: true,
      weight: 1,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    };

    onAffirmationsChange([item, ...allAffirmations]);
    if (item.language === locale && item.type === viewType) {
      onPickAffirmation(item);
    }
    setShowAddForm(false);
    setNewTitle('');
    setNewContent('');
    setNewYoutubeUrl('');
    setNewTags('');
  }

  function deleteAffirmation(id: string) {
    onAffirmationsChange(allAffirmations.filter((a) => a.id !== id));
  }

  if (showManager) {
    return (
      <AffirmationManager
        affirmations={allAffirmations.filter((a) => a.language === locale)}
        showAddForm={showAddForm}
        newType={newType}
        newTitle={newTitle}
        newContent={newContent}
        newYoutubeUrl={newYoutubeUrl}
        newTags={newTags}
        onShowAddForm={setShowAddForm}
        onNewTypeChange={setNewType}
        onNewTitleChange={setNewTitle}
        onNewContentChange={setNewContent}
        onNewYoutubeUrlChange={setNewYoutubeUrl}
        onNewTagsChange={setNewTags}
        onAdd={addAffirmation}
        onDelete={deleteAffirmation}
        onClose={() => setShowManager(false)}
      />
    );
  }

  if (showFocusMode && activeAffirmation?.type === 'text') {
    return (
      <AffirmationFocusMode
        text={activeAffirmation.textContent}
        title={activeAffirmation.title}
        onClose={() => setShowFocusMode(false)}
      />
    );
  }

  return (
    <div>
      <p className="eyebrow">Affirmation</p>
      <h2 className="mt-4 text-3xl font-black">{t('affirmation.title')}</h2>
      <p className="mt-3 text-[var(--muted)]">{t('affirmation.subtitle')}</p>

      <div className="mt-6 rounded-[20px] border border-[color:var(--color-border)] fill-1 p-4">
        <p className="text-sm leading-7 txt-strong">{t('affirmation.readAloud')}</p>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          className={`focus-ring rounded-full px-5 py-2 text-sm font-bold transition ${
            viewType === 'text'
              ? 'bg-[var(--accent)] text-white'
              : 'border border-[var(--border)] fill-1 hover:fill-2'
          }`}
          type="button"
          onClick={() => switchViewType('text')}
        >
          {t('affirmation.modeText')}
        </button>
        <button
          className={`focus-ring rounded-full px-5 py-2 text-sm font-bold transition ${
            viewType === 'youtube'
              ? 'bg-[var(--blue)] text-white'
              : 'border border-[var(--border)] fill-1 hover:fill-2'
          }`}
          type="button"
          onClick={() => switchViewType('youtube')}
        >
          {t('affirmation.modeVideo')}
        </button>
      </div>

      {activeAffirmation ? (
        <div className="mt-5 rounded-[22px] border border-[color:var(--color-border)] fill-2 p-6">
          {activeAffirmation.type === 'text' && (
            <button
              type="button"
              className="w-full text-start"
              onClick={() => setShowFocusMode(true)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="field-label mb-0 txt-muted">{activeAffirmation.title}</p>
                  <p className="mt-4 text-xl font-bold leading-9">{activeAffirmation.textContent}</p>
                </div>
                <span className="rounded-full border border-[color:var(--color-border)] fill-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] txt-soft">
                  {t('affirmation.focusMode')}
                </span>
              </div>
            </button>
          )}
          {activeAffirmation.type === 'youtube' && activeAffirmation.youtubeVideoId && (
            <div>
              <p className="mb-3 font-bold">{activeAffirmation.title}</p>
              <p className="mb-4 text-sm leading-7 text-[var(--muted)]">{t('affirmation.mediaSupport')}</p>
              <div className="aspect-video overflow-hidden rounded-lg">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${activeAffirmation.youtubeVideoId}?controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0`}
                  title={activeAffirmation.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          )}
          {activeAffirmation.tags.length > 0 && (
            <div className="mt-4">
              <p className="field-label mb-0 txt-muted">{t('affirmation.filterLabel')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeAffirmation.tags.map((tag) => {
                  const isActive = activeTagFilter?.toLowerCase() === tag.toLowerCase();

                  return (
                    <button
                      key={tag}
                      aria-pressed={isActive}
                      className={`focus-ring rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        isActive
                          ? 'border border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                          : 'border border-white/10 bg-black/35 text-[var(--muted)] hover:bg-white/8 hover:text-white'
                      }`}
                      type="button"
                      onClick={() => pickByTag(tag)}
                    >
                      {formatAffirmationTag(tag)}
                    </button>
                  );
                })}
              </div>
              {activeTagFilter ? (
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {t('affirmation.activeFilter', {tag: formatAffirmationTag(activeTagFilter)})}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : viewType === 'youtube' && !hasYoutubeAffirmations ? (
        <div className="mt-5 rounded-[22px] border border-dashed border-[var(--border)] p-6 text-center">
          <p className="text-[var(--muted)]">{t('affirmation.noVideoYet')}</p>
          <button
            className="focus-ring btn-primary mt-3"
            type="button"
            onClick={() => {
              setNewType('youtube');
              setShowManager(true);
              setShowAddForm(true);
            }}
          >
            {t('affirmation.addVideo')}
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-[22px] border border-dashed border-[var(--border)] p-6 text-center text-[var(--muted)]">
          {activeTagFilter
            ? t('affirmation.noFilteredAffirmations', {tag: formatAffirmationTag(activeTagFilter)})
            : t('affirmation.noAffirmations')}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="focus-ring btn-ghost"
          type="button"
          onClick={pickAnotherWithinCurrentFilter}
        >
          {activeTagFilter ? t('affirmation.anotherFiltered') : t('affirmation.another')}
        </button>
        {activeAffirmation?.type === 'text' ? (
          <button
            className="focus-ring btn-ghost"
            type="button"
            onClick={() => setShowFocusMode(true)}
          >
            {t('affirmation.focusMode')}
          </button>
        ) : null}
        <button
          className="focus-ring btn-ghost"
          type="button"
          onClick={() => setActiveTagFilter(null)}
          disabled={!activeTagFilter}
        >
          {t('affirmation.clearFilter')}
        </button>
        <button
          className="focus-ring btn-ghost"
          type="button"
          onClick={() => setShowManager(true)}
        >
          {t('affirmation.manage')}
        </button>
      </div>

      <StepNavigation onBack={onBack} onNext={onNext} />
    </div>
  );
}

function AffirmationFocusMode({
  text,
  title,
  onClose,
}: {
  text: string;
  title: string;
  onClose: () => void;
}) {
  const t = useTranslations('morningRitual');

  return (
    <div className="ritual-step-enter rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,18,0.98),rgba(5,8,13,1))] px-6 py-10 shadow-[0_28px_80px_rgba(0,0,0,0.42)] sm:px-10 sm:py-14">
      <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center text-center">
        <p className="eyebrow justify-center">{title}</p>
        <div
          dir="auto"
          className="mt-6 max-w-[18ch] whitespace-pre-wrap break-words text-balance text-[clamp(1.9rem,5vw,4rem)] font-black leading-[1.28] text-white [overflow-wrap:anywhere]"
        >
          {text}
        </div>
        <p className="mt-8 max-w-2xl text-lg leading-8 text-white/72">{t('affirmation.readAloud')}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button className="focus-ring btn-primary" type="button" onClick={onClose}>
            {t('affirmation.focusClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
