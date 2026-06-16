import {readFileSync, existsSync} from 'fs';
import {resolve} from 'path';

const envPath = resolve('.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

import {openaiFormulationService} from '../src/lib/ai-formulation/openai-formulation-service';
import {buildFallbackExplorationQuestions} from '../src/lib/formulation/exploration-fallback';
import {buildGenerateExplorationQuestionsUserPrompt} from '../src/lib/ai-formulation/prompts';
import {guardExplorationQuestions} from '../src/lib/formulation/output-guard';
import type {FormulationSession} from '../src/lib/life-coach/types';

const session = {
  id: 'test',
  user_id: 'u',
  locale: 'he',
  status: 'draft',
  current_phase: 'exploration',
  life_context_statuses: ['between_jobs', 'new_parent'],
  life_context_status_note: null,
  participant_gender: 'male',
  participant_age: 35,
  passive_ratings: [
    {key: 'male_provider_pressure_between_jobs', score: 5},
    {key: 'worry_load', score: 4},
    {key: 'sleep_quality', score: 1},
    {key: 'work_pressure', score: 4},
  ],
  prior_question_answers: [
    {key: 'sleep_follow', answer: 'not_at_all'},
    {key: 'work_follow', answer: 'not_at_all'},
  ],
  rating_follow_ups: [
    {
      key: 'sleep_follow',
      questionKey: 'followUps.sleep',
      weight: 5,
      source_rating_key: 'sleep_quality',
    },
    {
      key: 'work_follow',
      questionKey: 'followUps.work',
      weight: 4,
      source_rating_key: 'work_pressure',
    },
  ],
  llm_exploration_questions: [],
  llm_exploration_answers: [],
  presenting_concern_user_words: 'לחץ פרנסה',
  presenting_concern_raw: null,
  reflection_llm_text: null,
  dimensions: null,
  phases_skipped: [],
  risk_q1: 0,
  risk_q2: 0,
  risk_level: 'none',
  risk_action: 'continue',
  formulation_draft: null,
  formulation_approved: null,
  coach_handoff: null,
  created_at: '',
  updated_at: '',
} as unknown as FormulationSession;

async function main() {
  const userPrompt = buildGenerateExplorationQuestionsUserPrompt(session, 'he');
  console.log('userPrompt chars:', userPrompt.length);

  const result = await openaiFormulationService.generateExplorationQuestions(session, 'he');
  const fb = buildFallbackExplorationQuestions(session, 'he');
  const isFallback = result.questions[0]?.text === fb[0]?.text;

  console.log('validation_passed:', result.validation_passed);
  console.log('metrics:', result.metrics);
  console.log('is_exact_fallback:', isFallback);
  console.log('q01:', result.questions[0]?.text);
  console.log('fb01:', fb[0]?.text);

  const guard = guardExplorationQuestions(result.questions, 'he');
  console.log('guard ok:', guard.ok);
  if (!guard.ok) console.log('guard reasons:', guard.reasons);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
