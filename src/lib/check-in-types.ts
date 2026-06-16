type LegacyEmotion =
  | 'driven'
  | 'flat'
  | 'anxious'
  | 'avoidant'
  | 'disappointed'
  | 'excited'
  | 'overwhelmed'
  | 'confused'
  | 'angry'
  | 'grateful';

export type CheckInTagCategory = 'momentum' | 'stress' | 'lowBattery' | 'grounded';

export type CheckInTag =
  | 'driven'
  | 'laserFocused'
  | 'inspired'
  | 'disciplined'
  | 'stressed'
  | 'stuck'
  | 'distracted'
  | 'anxious'
  | 'exhausted'
  | 'burntOut'
  | 'apathetic'
  | 'calm'
  | 'aligned'
  | 'grateful';

export type CheckInRecommendationType = 'guidedAudio' | 'breatheReset' | 'depthWork';

export type CheckInInsightKey =
  | 'lowEnergyLowFocus'
  | 'stressReset'
  | 'peakState'
  | 'groundedClarity'
  | 'rebuildMomentum'
  | 'steadyAction';

type FollowUp = {
  id: string;
  question: string;
  response: string;
  createdAt: string;
};

export type CheckInEntry = {
  id: string;
  createdAt: string;
  focus: number;
  energy: number;
  selectedTags: CheckInTag[];
  primaryTag: CheckInTag;
  priorityAction: string;
  stateScore: number;
  momentum: number;
  recommendationType: CheckInRecommendationType;
  recommendedAffirmationId: string;
  recommendedAffirmationTags: string[];
  recommendedAction: string;
  insightKey: CheckInInsightKey;
  coachSupport?: string;
  challengeDone: boolean;
  followUps?: FollowUp[];
  // Raw behavioral metrics
  sessionDurationSec?: number;
  sliderAdjustments?: number;
  openedCoachSupport?: boolean;
  // Psychological metrics
  priorityActionWordCount?: number;
  rewrotePriorityActionCount?: number;
  tagValenceShift?: -1 | 0 | 1;
  energyFocusDivergence?: number;
  physicalComplaintMentioned?: boolean;
  helpEngagementDepth?: 'none' | 'glanced' | 'read' | 'acted';
  statedActionCompleted?: boolean | null;
  domainSignal?: {
    activeDomainId?: string | null;
    weakestDomainId?: string | null;
    confirmedActiveDomain?: boolean | null;
    source?: 'daily_focus_context';
  };
};

export type LegacyCheckInEntry = {
  id: string;
  createdAt: string;
  emotion: LegacyEmotion;
  escape: number;
  energy: number;
  truth: string;
  coachResponse?: string;
  dailyChallenge?: string;
  challengeDone?: boolean;
  followUps?: FollowUp[];
};
