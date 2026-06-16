/**
 * Lightweight guardrail checks (no test framework).
 * Run: node scripts/verify-formulation-guardrails.mjs
 */

function evaluateRiskScreen(input) {
  const q1Yes = input.q1 === 1;
  const q2Yes = input.q2 === 1;
  if (q1Yes || q2Yes) {
    if (input.followUpConfirmed === false) {
      return {level: 'none', action: 'continue', needsFollowUp: false};
    }
    if (input.followUpConfirmed === true) {
      return {level: 'crisis', action: 'stop', needsFollowUp: false};
    }
    return {level: 'crisis', action: 'resources', needsFollowUp: true};
  }
  return {level: 'none', action: 'continue', needsFollowUp: false};
}

const FORBIDDEN = [/\bptsd\b/i, /\bדיכאון\b/i, /הבעיה שלך/i];

function guardText(text) {
  return !FORBIDDEN.some((p) => p.test(text));
}

let failed = 0;

function assert(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failed++;
  } else {
    console.log(`OK: ${name}`);
  }
}

assert('crisis on yes + confirmed', evaluateRiskScreen({q1: 1, q2: 0, followUpConfirmed: true}).action === 'stop');
assert('continue on yes + denied follow-up', evaluateRiskScreen({q1: 1, q2: 0, followUpConfirmed: false}).action === 'continue');
assert('needs follow-up when yes unconfirmed', evaluateRiskScreen({q1: 1, q2: 0}).needsFollowUp === true);
assert('none when both no', evaluateRiskScreen({q1: 0, q2: 0}).level === 'none');
assert('blocks PTSD label', !guardText('You have PTSD'));
assert('allows reflection', guardText('נשמע שעייפות אחרי הצהריים מפריעה לך'));

if (failed > 0) {
  process.exit(1);
}
console.log('All formulation guardrail checks passed.');
