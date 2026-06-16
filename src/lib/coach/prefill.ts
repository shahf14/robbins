import type {CheckInTag} from '@/lib/check-in-types';

/** Maps check-in tags to /api/coach emotional states. */
export const coachStateByTag: Record<CheckInTag, string> = {
  driven: 'driven',
  laserFocused: 'driven',
  inspired: 'excited',
  disciplined: 'driven',
  stressed: 'overwhelmed',
  stuck: 'avoidant',
  distracted: 'confused',
  anxious: 'anxious',
  exhausted: 'flat',
  burntOut: 'disappointed',
  apathetic: 'flat',
  calm: 'grateful',
  aligned: 'grateful',
  grateful: 'grateful',
};
