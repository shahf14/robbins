/**
 * Diagnose step-5 exploration question generation.
 * Run: node scripts/probe-exploration-ai.mjs
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_LIFE_COACH_STRUCTURING_MODEL || 'gpt-4.1-mini';

console.log('OPENAI_API_KEY:', apiKey ? `set (${apiKey.length} chars)` : 'MISSING');
console.log('model:', model);

if (!apiKey) {
  process.exit(1);
}

const systemPrompt = [
  'Return only valid JSON: { "questions": [ { "id": "q01".."q15", "text": "...", "focus_area": "tag" } ] }',
  'Each text: first-person Hebrew statement, no question marks, ids exactly q01 through q15.',
].join('\n');

const userPrompt = JSON.stringify(
  {
    locale: 'he',
    burning_now: ['לחץ פרנסה במעבר', 'ביקורת עצמית'],
    suppressed: ['שינה'],
  },
  null,
  2
);

const res = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
  body: JSON.stringify({
    model,
    instructions: systemPrompt,
    input: userPrompt,
    max_output_tokens: 2800,
  }),
});

console.log('HTTP status:', res.status, res.statusText);
const body = await res.json();

if (!res.ok) {
  console.log('Error body:', JSON.stringify(body, null, 2).slice(0, 2000));
  process.exit(1);
}

const text =
  body.output_text?.trim() ??
  body.output
    ?.flatMap((i) => i.content ?? [])
    .map((c) => c.text)
    .filter(Boolean)
    .join('\n')
    .trim();

console.log('output_text length:', text?.length ?? 0);
console.log('usage:', body.usage);
console.log('--- first 500 chars ---');
console.log(text?.slice(0, 500));

let parsed;
try {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text;
  parsed = JSON.parse(candidate);
} catch (e) {
  console.log('JSON parse FAILED:', e.message);
  process.exit(1);
}

const questions = parsed?.questions ?? parsed;
console.log('question count:', Array.isArray(questions) ? questions.length : 'not array');
if (Array.isArray(questions)) {
  console.log('ids:', questions.map((q) => q.id).join(', '));
  const expected = Array.from({length: 15}, (_, i) => `q${String(i + 1).padStart(2, '0')}`);
  const idOk = expected.every((id, i) => questions[i]?.id === id);
  console.log('ids exactly q01-q15:', idOk);
}
