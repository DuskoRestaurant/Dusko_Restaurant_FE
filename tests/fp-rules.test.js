import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_THRESHOLDS, parseThresholdForm, relaxOptions, withRelaxedThresholds, sortRules, barWidth, toFormValues } from '../src/fp-rules.js';

test('threshold form converts percentages into engine units', () => {
  assert.deepEqual(parseThresholdForm({ support: '5', confidence: '30', lift: '1.2', maxLength: '3' }),
    { support: 0.05, confidence: 0.3, lift: 1.2, maxLength: 3 });
  assert.deepEqual(parseThresholdForm({ support: '2.5', confidence: '0', lift: '0', maxLength: '6' }),
    { support: 0.025, confidence: 0, lift: 0, maxLength: 6 });
});

test('threshold form rejects values the engine cannot mine', () => {
  assert.throws(() => parseThresholdForm({ support: '0', confidence: '30', lift: '1.2', maxLength: '3' }), /Support/);
  assert.throws(() => parseThresholdForm({ support: '101', confidence: '30', lift: '1.2', maxLength: '3' }), /Support/);
  assert.throws(() => parseThresholdForm({ support: '5', confidence: '-1', lift: '1.2', maxLength: '3' }), /Confidence/);
  assert.throws(() => parseThresholdForm({ support: '5', confidence: '30', lift: '-2', maxLength: '3' }), /Lift/);
  assert.throws(() => parseThresholdForm({ support: '5', confidence: '30', lift: '1.2', maxLength: '0' }), /tập/);
  assert.throws(() => parseThresholdForm({ support: '5', confidence: '30', lift: '1.2', maxLength: '99' }), /tập/);
  assert.throws(() => parseThresholdForm({ support: 'abc', confidence: '30', lift: '1.2', maxLength: '3' }), /Support/);
});

test('relax options only propose softer thresholds', () => {
  const options = relaxOptions({ support: 0.05, confidence: 0.3, lift: 1.2, maxLength: 3 });
  assert.deepEqual(options.map(option => option.key), ['confidence', 'lift', 'support']);
  assert.deepEqual(relaxOptions({ support: 0.02, confidence: 0.2, lift: 1, maxLength: 3 }), []);
  const relaxed = withRelaxedThresholds({ support: 0.05, confidence: 0.3, lift: 1.2, maxLength: 3 }, 'confidence', 0.2);
  assert.equal(relaxed.confidence, 0.2);
  assert.equal(relaxed.support, 0.05, 'relaxing one threshold keeps the others');
  const all = withRelaxedThresholds({ support: 0.05, confidence: 0.3, lift: 1.2, maxLength: 3 }, 'all', 0);
  assert.equal(all.support, 0.02);
  assert.equal(all.confidence, 0.2);
  assert.equal(all.lift, 1);
  assert.equal(all.maxLength, 3, 'itemset length is not relaxed automatically');
});

test('rule sorting supports both directions and leaves the source untouched', () => {
  const rules = [{ lift: 1.2, confidence: 0.5 }, { lift: 2.4, confidence: 0.3 }];
  assert.deepEqual(sortRules(rules, { key: 'lift', dir: 'desc' }).map(rule => rule.lift), [2.4, 1.2]);
  assert.deepEqual(sortRules(rules, { key: 'lift', dir: 'asc' }).map(rule => rule.lift), [1.2, 2.4]);
  assert.deepEqual(sortRules(rules, { key: 'confidence', dir: 'desc' }).map(rule => rule.confidence), [0.5, 0.3]);
  assert.deepEqual(rules.map(rule => rule.lift), [1.2, 2.4], 'sorting must not mutate the input');
  assert.deepEqual(sortRules([], { key: 'lift', dir: 'desc' }), []);
});

test('metric bars stay readable for extreme values', () => {
  assert.equal(barWidth(0.25), '25.0');
  assert.equal(barWidth(0.5, 2), '100.0');
  assert.equal(barWidth(0), '2.0');
  assert.equal(barWidth(9, 1), '100.0');
});

test('threshold values round-trip through the form representation', () => {
  assert.deepEqual(toFormValues(DEFAULT_THRESHOLDS), { support: '5.0', confidence: '30', lift: '1.2', maxLength: '3' });
  assert.deepEqual(toFormValues({ support: 0.025, confidence: 0.1, lift: 0.9, maxLength: 5 }),
    { support: '2.5', confidence: '10', lift: '0.9', maxLength: '5' });
  assert.deepEqual(toFormValues(undefined), { support: '5.0', confidence: '30', lift: '1.2', maxLength: '3' });
});
