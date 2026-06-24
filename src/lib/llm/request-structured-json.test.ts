import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {z} from 'zod';
import {parseZodJsonFromLlmText, stripJsonCodeFence} from '../safe-json.ts';

const here = dirname(fileURLToPath(import.meta.url));
const sampleSchema = z.object({answer: z.number()});

test('stripJsonCodeFence removes markdown fences', () => {
  assert.equal(stripJsonCodeFence('```json\n{"answer":1}\n```'), '{"answer":1}');
  assert.equal(stripJsonCodeFence('{"answer":1}'), '{"answer":1}');
});

test('parseZodJsonFromLlmText accepts valid JSON', () => {
  assert.deepEqual(parseZodJsonFromLlmText('{"answer":42}', sampleSchema), {answer: 42});
});

test('parseZodJsonFromLlmText accepts fenced JSON', () => {
  assert.deepEqual(
    parseZodJsonFromLlmText('```json\n{"answer":7}\n```', sampleSchema),
    {answer: 7}
  );
});

test('parseZodJsonFromLlmText returns null for malformed or invalid schema', () => {
  assert.equal(parseZodJsonFromLlmText('not json', sampleSchema), null);
  assert.equal(parseZodJsonFromLlmText('{"answer":"nope"}', sampleSchema), null);
});

test('requestStructuredJson helper delegates parse and fallback to shared primitives', () => {
  const source = readFileSync(join(here, 'request-structured-json.ts'), 'utf8');

  assert.match(source, /callOpenAiResponses/);
  assert.match(source, /parseZodJsonFromLlmText/);
  assert.match(source, /data \?\? opts\.fallback/);
  assert.match(source, /export async function requestStructuredJson/);
  assert.match(source, /export async function tryRequestStructuredJson/);
});

test('micro-goal generation keeps a 3-attempt retry loop on structured JSON', () => {
  const source = readFileSync(
    join(here, '..', 'ai-formulation', 'openai-formulation-service.ts'),
    'utf8'
  );

  assert.match(source, /for \(let attempt = 0; attempt < 3; attempt\+\+\)/);
  assert.match(source, /tryRequestStructuredJson\(/);
});
