import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {StartHereExperience} from '@/components/start-here/start-here-experience';
import {isLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale: rawLocale} = await params;
  if (!isLocale(rawLocale)) notFound();
  setRequestLocale(rawLocale);

  return {
    title: rawLocale === 'he' ? 'התחל כאן | אפליקציית רובינס' : 'Start Here | Robbins App',
    description:
      rawLocale === 'he'
        ? 'דף היכרות אינטראקטיבי שמראה איך להשתמש בכל הפיצ׳רים באתר כדי לבנות בהירות, מומנטום וביצוע יומי.'
        : 'An interactive orientation page for using every core feature to build clarity, momentum, and daily execution.',
  };
}

export default async function StartHerePage({params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);

  return <StartHereExperience />;
}
