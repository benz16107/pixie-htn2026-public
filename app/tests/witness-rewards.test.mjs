import { test } from 'node:test';
import assert from 'node:assert/strict';
import { witnessRewards, allocateCredit, creditPreview } from '../../shared/witness-rewards.ts';
const evidence = (patch = {}) => ({ id: 'e1', clientId: 'witness', role: 'bystander', status: 'accepted', credit: 5, rewardAtSubmission: 5, ...patch });
const incident = (items, owner = 'driver') => ({ clientId: owner, evidence: items });

test('only accepted contributions by another person earn savings; pending stays separate', () => {
  const reports = [incident([evidence(), evidence({ id: 'e2', status: 'pending', credit: 0, rewardAtSubmission: 2 }), evidence({ id: 'e3', status: 'rejected', credit: 0 }), evidence({ id: 'e4', clientId: 'someone-else' }), evidence({ id: 'e5', role: 'driver' })]), incident([evidence({ id: 'e6' })], 'witness')];
  assert.deepEqual(witnessRewards(reports, 'witness'), { earned: 5, pending: 2, acceptedCount: 1 });
  reports[0].evidence[0].status = 'rejected';
  assert.equal(witnessRewards(reports, 'witness').earned, 0);
});
test('repeated records do not multiply a balance, and seeded zero-credit examples earn nothing', () => {
  assert.deepEqual(witnessRewards([incident([evidence(), evidence(), evidence({ id: 'seed', credit: 0 })])], 'witness'), { earned: 5, pending: 0, acceptedCount: 1 });
});
test('allocation preserves every cent without double-spending across products', () => {
  assert.deepEqual(allocateCredit(5, 'split'), { home: 2.5, auto: 2.5 });
  assert.deepEqual(allocateCredit(5.01, 'split'), { home: 2.5, auto: 2.51 });
  assert.deepEqual(allocateCredit(5, 'home'), { home: 5, auto: 0 });
  assert.deepEqual(allocateCredit(5, 'auto'), { home: 0, auto: 5 });
});
test('preview is one payment, capped at zero, with leftover credit and no fabricated missing estimate', () => {
  assert.deepEqual(creditPreview(90.47, 2), { base: 90.47, applied: 2, nextPayment: 88.47, remaining: 0 });
  assert.deepEqual(creditPreview(3, 5), { base: 3, applied: 3, nextPayment: 0, remaining: 2 });
  assert.equal(creditPreview(null, 5), null);
  assert.equal(creditPreview(NaN, 5), null);
});
