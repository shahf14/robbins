import type {ToolsBarToolId} from '@/lib/schedule-content';
import type {HomeNowAction} from './resolve-home-now-action';

export type RecommendedPathTool = 'morning_ritual' | 'daily_step' | 'evening';

export function getRecommendedPathTool(action: HomeNowAction): RecommendedPathTool {
  if (action.kind === 'morning_ritual') return 'morning_ritual';
  if (action.kind === 'evening_reset') return 'evening';
  return 'daily_step';
}

export function getRecommendedToolLabelKey(tool: RecommendedPathTool): string {
  if (tool === 'daily_step') return 'home.recommendedPath.tools.dailyStep';
  if (tool === 'evening') return 'home.recommendedPath.tools.evening';
  return 'home.recommendedPath.tools.morningRitual';
}

export function getRecommendedToolsBarId(tool: RecommendedPathTool): ToolsBarToolId {
  if (tool === 'morning_ritual') return 'morning';
  if (tool === 'evening') return 'evening';
  return 'coach';
}
