'use client';

import {useTranslations} from 'next-intl';
import {type FormEvent, useEffect, useState} from 'react';
import type {IdentityOption} from '@/lib/morning-ritual-types';
import {fetchRitualContent, saveIdentities} from '@/lib/morning-ritual-storage';
import {recordAdminActivity, type AdminActivityKey} from '@/lib/admin/admin-activity';
import {scheduleDeferredRitualCommit} from '@/lib/morning-ritual/deferred-ritual-persist';
import {useConfirm} from '@/components/feedback/confirm-provider';
import {useToast} from '@/components/feedback/toast-provider';
import {
  AdminActionButton,
  AdminCreateButton,
  AdminEmptyState,
} from '@/components/admin/admin-shell';

export function AdminIdentitiesPanel({onActivity}: {onActivity?: (key: AdminActivityKey) => void}) {
  const t = useTranslations();
  const tRitual = useTranslations('morningRitual');
  const {confirm} = useConfirm();
  const toast = useToast();

  const [identities, setIdentities] = useState<IdentityOption[]>([]);
  const [newIdentity, setNewIdentity] = useState('');

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      void fetchRitualContent().then(({identities: savedIdentities}) => {
        if (cancelled) return;
        setIdentities(savedIdentities);
      }).catch(() => {});
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  function addIdentity(e: FormEvent) {
    e.preventDefault();
    if (!newIdentity.trim()) return;
    const item: IdentityOption = {
      id: crypto.randomUUID(),
      text: newIdentity.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...identities];
    setIdentities(next);
    saveIdentities(next);
    if (onActivity) onActivity('identitiesSave');
    else recordAdminActivity('identitiesSave');
    setNewIdentity('');
    toast.success(t('admin.content.identityAddedToast'));
  }

  async function deleteIdentity(id: string) {
    const ok = await confirm({
      title: t('admin.content.deleteIdentityConfirmTitle'),
      message: t('admin.content.deleteIdentityConfirmMessage'),
      confirmLabel: t('admin.content.deleteIdentity'),
      destructive: true,
    });
    if (!ok) return;
    const previous = identities;
    const next = identities.filter((i) => i.id !== id);
    setIdentities(next);
    scheduleDeferredRitualCommit({
      key: 'admin-identities',
      commit: () => {
        saveIdentities(next);
        if (onActivity) onActivity('identitiesSave');
        else recordAdminActivity('identitiesSave');
      },
      undo: () => setIdentities(previous),
      toast,
      message: tRitual('identity.deletedUndo'),
      undoLabel: tRitual('common.undo'),
    });
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{t('admin.content.identitiesTitle')}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('admin.content.identitiesDescription')}</p>
        </div>
      </div>

      <form className="flex flex-wrap gap-2" onSubmit={addIdentity}>
        <input
          className="focus-ring input-base min-w-[12rem] flex-1"
          value={newIdentity}
          placeholder={t('admin.content.identityPlaceholder')}
          onChange={(e) => setNewIdentity(e.target.value)}
        />
        <AdminCreateButton className="shrink-0 disabled:opacity-60" type="submit" disabled={!newIdentity.trim()}>
          {t('admin.content.addIdentity')}
        </AdminCreateButton>
      </form>

      <div className="grid gap-2">
        {identities.length === 0 ? (
          <AdminEmptyState
            title={t('admin.content.emptyIdentitiesTitle')}
            description={t('admin.content.emptyIdentitiesDetail')}
          />
        ) : null}
        {identities.map((identity) => (
          <div key={identity.id} className="panel-surface flex items-center justify-between gap-3 p-3">
            <p className="min-w-0 truncate text-sm">{identity.text}</p>
            <AdminActionButton
              className="shrink-0 text-xs"
              destructive
              onClick={() => void deleteIdentity(identity.id)}
            >
              {t('admin.content.deleteIdentity')}
            </AdminActionButton>
          </div>
        ))}
      </div>
    </section>
  );
}
