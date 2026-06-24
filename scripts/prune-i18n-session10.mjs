import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const ONBOARDING_KEEP = new Set([
  'stepCounter',
  'step1Title',
  'step1Body',
  'step1ZoneNow',
  'step1LifeContextHint',
  'step2Eyebrow',
  'quickStartDomainRequired',
  'lifeContextQuestion',
  'lifeContextNotePlaceholder',
  'actionWindow',
  'physical',
  'availableTimeOption',
  'intensity',
  'family',
  'resumeBanner',
  'resumeStartOver',
  'saving',
  'next',
]);

function pruneMessages(fileName) {
  const path = join(ROOT, 'messages', fileName);
  const data = JSON.parse(readFileSync(path, 'utf8'));

  delete data.aiActionHelp?.onboardingInsight;
  delete data.aiActionHelp?.onboardingGoal;
  delete data.aiActionHelp?.onboardingFirstStep;

  delete data.nav?.dashboard;
  delete data.nav?.checkin;
  delete data.nav?.history;
  delete data.nav?.calmSpace;
  delete data.nav?.checkinShort;
  delete data.nav?.calmSpaceShort;

  if (data.home?.dayMode) {
    delete data.home.dayMode;
  }

  if (data.lifeContext?.onboarding) {
    delete data.lifeContext.onboarding;
  }

  if (data.onboarding && typeof data.onboarding === 'object') {
    for (const key of Object.keys(data.onboarding)) {
      if (!ONBOARDING_KEEP.has(key)) {
        delete data.onboarding[key];
      }
    }
  }

  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Pruned ${fileName}`);
}

pruneMessages('en.json');
pruneMessages('he.json');
