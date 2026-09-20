import type { RoadIncident } from './evidence';

export type CreditAllocation = 'split' | 'home' | 'auto';
const cents = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0;

export function witnessRewards(reports: RoadIncident[], clientId: string) {
  let earned = 0;
  let pending = 0;
  let acceptedCount = 0;
  const seen = new Set<string>();
  for (const report of reports) {
    if (report.clientId === clientId) continue;
    for (const item of report.evidence) {
      if (item.clientId !== clientId || item.role !== 'bystander' || seen.has(item.id)) continue;
      seen.add(item.id);
      if (item.status === 'accepted' && item.credit > 0) {
        earned += cents(item.credit);
        acceptedCount++;
      } else if (item.status === 'pending') pending += cents(item.rewardAtSubmission);
    }
  }
  return { earned: earned / 100, pending: pending / 100, acceptedCount };
}

export function allocateCredit(earned: number, allocation: CreditAllocation) {
  const total = cents(earned);
  const home = allocation === 'home' ? total : allocation === 'auto' ? 0 : Math.floor(total / 2);
  return { home: home / 100, auto: (total - home) / 100 };
}

export function creditPreview(monthly: number | null, credit: number) {
  if (monthly === null || !Number.isFinite(monthly) || monthly < 0) return null;
  const base = cents(monthly);
  const available = cents(credit);
  const applied = Math.min(base, available);
  return { base: base / 100, applied: applied / 100, nextPayment: (base - applied) / 100, remaining: (available - applied) / 100 };
}
