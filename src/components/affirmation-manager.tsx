'use client';

import {useTranslations} from 'next-intl';
import {useConfirm} from '@/components/feedback/confirm-provider';
import type {AffirmationItem, AffirmationType} from '@/lib/morning-ritual-types';

export function formatAffirmationTag(tag: string) {
  return tag
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function AffirmationManager({
  affirmations,
  showAddForm,
  newType,
  newTitle,
  newContent,
  newYoutubeUrl,
  newTags,
  onShowAddForm,
  onNewTypeChange,
  onNewTitleChange,
  onNewContentChange,
  onNewYoutubeUrlChange,
  onNewTagsChange,
  onAdd,
  onDelete,
  onClose,
}: {
  affirmations: AffirmationItem[];
  showAddForm: boolean;
  newType: AffirmationType;
  newTitle: string;
  newContent: string;
  newYoutubeUrl: string;
  newTags: string;
  onShowAddForm: (show: boolean) => void;
  onNewTypeChange: (type: AffirmationType) => void;
  onNewTitleChange: (value: string) => void;
  onNewContentChange: (value: string) => void;
  onNewYoutubeUrlChange: (value: string) => void;
  onNewTagsChange: (value: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('morningRitual');
  const {confirm} = useConfirm();

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t('affirmation.deleteConfirmTitle'),
      message: t('affirmation.deleteConfirmMessage'),
      confirmLabel: t('affirmation.delete'),
      cancelLabel: t('affirmation.cancel'),
      destructive: true,
    });
    if (ok) onDelete(id);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black">{t('affirmation.manage')}</h2>
        <button
          className="focus-ring btn-ghost"
          type="button"
          onClick={onClose}
        >
          {t('common.back')}
        </button>
      </div>

      <button
        className="focus-ring btn-primary mt-4"
        type="button"
        onClick={() => onShowAddForm(true)}
      >
        {t('affirmation.addNew')}
      </button>

      {showAddForm && (
        <div className="panel-surface mt-4 p-4">
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="field-label mb-0">{t('affirmation.type')}</span>
              <select
                className="focus-ring select-base"
                value={newType}
                onChange={(e) => onNewTypeChange(e.target.value as AffirmationType)}
              >
                <option value="text">{t('affirmation.text')}</option>
                <option value="youtube">{t('affirmation.youtube')}</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="field-label mb-0">{t('affirmation.titleField')}</span>
              <input
                className="focus-ring input-base"
                value={newTitle}
                onChange={(e) => onNewTitleChange(e.target.value)}
              />
            </label>

            {newType === 'text' && (
              <label className="grid gap-1">
                <span className="field-label mb-0">{t('affirmation.content')}</span>
                <textarea
                  className="focus-ring textarea-base min-h-24"
                  value={newContent}
                  onChange={(e) => onNewContentChange(e.target.value)}
                />
              </label>
            )}

            {newType === 'youtube' && (
              <label className="grid gap-1">
                <span className="field-label mb-0">{t('affirmation.youtubeUrl')}</span>
                <input
                  className="focus-ring input-base"
                  value={newYoutubeUrl}
                  placeholder="https://youtube.com/watch?v=..."
                  onChange={(e) => onNewYoutubeUrlChange(e.target.value)}
                />
              </label>
            )}

            <label className="grid gap-1">
              <span className="field-label mb-0">{t('affirmation.tags')}</span>
              <input
                className="focus-ring input-base"
                value={newTags}
                placeholder="confidence, energy, discipline"
                onChange={(e) => onNewTagsChange(e.target.value)}
              />
            </label>

            <div className="flex gap-2">
              <button
                className="focus-ring btn-primary disabled:opacity-60"
                type="button"
                onClick={onAdd}
                disabled={!newTitle.trim() || (newType === 'text' ? !newContent.trim() : !newYoutubeUrl.trim())}
              >
                {t('affirmation.save')}
              </button>
              <button
                className="focus-ring btn-secondary"
                type="button"
                onClick={() => onShowAddForm(false)}
              >
                {t('affirmation.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {affirmations.map((aff) => (
          <div key={aff.id} className="panel-surface flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-bold">{aff.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                {aff.type === 'youtube' ? aff.youtubeUrl : aff.textContent}
              </p>
              {aff.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {aff.tags.map((tag) => (
                    <span key={tag} className="text-xs text-[var(--muted)]">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
            {!aff.isDefault && (
              <button
                className="focus-ring btn-small shrink-0"
                type="button"
                onClick={() => void handleDelete(aff.id)}
              >
                {t('affirmation.delete')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
