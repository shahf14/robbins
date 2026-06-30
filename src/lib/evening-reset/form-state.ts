import type {GratitudeCategory} from '@/lib/evening-reset-types';

export type EveningFormState = {
  dayMood: number | null;
  biggestWin: string;
  successFactors: string;
  blockers: string;
  emotionalDump: string;
  gratitudeItems: string[];
  gratitudeCategories: GratitudeCategory[];
  aiInsight: string;
  tomorrowsWin: string;
  tomorrowTakeaway: string;
  preparedItems: string[];
  sleepTarget: string;
  prepInput: string;
};

export const INITIAL_EVENING_FORM: EveningFormState = {
  dayMood: null,
  biggestWin: '',
  successFactors: '',
  blockers: '',
  emotionalDump: '',
  gratitudeItems: ['', '', ''],
  gratitudeCategories: [],
  aiInsight: '',
  tomorrowsWin: '',
  tomorrowTakeaway: '',
  preparedItems: [],
  sleepTarget: '',
  prepInput: '',
};

export type EveningFormAction =
  | {type: 'patch'; patch: Partial<EveningFormState>}
  | {
      type: 'reset';
      preparedItems?: string[];
      sleepTarget?: string;
    };

export function eveningFormReducer(
  state: EveningFormState,
  action: EveningFormAction
): EveningFormState {
  switch (action.type) {
    case 'patch':
      return {...state, ...action.patch};
    case 'reset':
      return {
        ...INITIAL_EVENING_FORM,
        preparedItems: action.preparedItems ?? [],
        sleepTarget: action.sleepTarget ?? '',
      };
    default:
      return state;
  }
}
