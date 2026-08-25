import { describe, expect, it } from 'vitest';

import { createOracleCache } from './cache';
import {
  assessOracleRequest,
  OracleVerifier,
  normalizeAmountToNumber,
  normalizeTimestampToMs,
} from './verifier';
import type {
  IndexerInvoiceHistoryEntry,
  OracleVerificationRequest,
  ReputationSnapshot,
} from './types';

const request: OracleVerificationRequest = {
  payer: 'GTESTPAYERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  amount: '10000000',
  invoiceId: '99',
};

// A genuinely healthy history: amounts spread far outside the 5% similar-amount
// band, creations five days apart so the rapid-succession heuristic stays
// quiet, and every settlement taking exactly ten days so variance is zero.
// The previous fixture had four amounts within 2% of the request, which tripped
// the similar-amount heuristic and made `isVerified: true` unreachable.
const healthyHistory: IndexerInvoiceHistoryEntry[] = [
  {
    id: 1,
    freelancer: 'G1',
    payer: request.payer,
    amount: '8000000',
    due_date: 0,
    discount_rate: 300,
    status: 'Paid',
    funder: 'G2',
    funded_at: 1700000000000,
    created_at: 1700000000000,
    updated_at: 1700864000000,
  },
  {
    id: 2,
    freelancer: 'G1',
    payer: request.payer,
    amount: '10000000',
    due_date: 0,
    discount_rate: 300,
    status: 'Paid',
    funder: 'G2',
    funded_at: 1700432000000,
    created_at: 1700432000000,
    updated_at: 1701296000000,
  },
  {
    id: 3,
    freelancer: 'G1',
    payer: request.payer,
    amount: '12000000',
    due_date: 0,
    discount_rate: 300,
    status: 'Paid',
    funder: 'G2',
    funded_at: 1700864000000,
    created_at: 1700864000000,
    updated_at: 1701728000000,
  },
  {
    id: 4,
    freelancer: 'G1',
    payer: request.payer,
    amount: '14000000',
    due_date: 0,
    discount_rate: 300,
    status: 'Defaulted',
    funder: 'G2',
    funded_at: 1701296000000,
    created_at: 1701296000000,
    updated_at: 1702160000000,
  },
];

/** Newest source timestamp across the healthy fixture. */
const HEALTHY_LATEST_MS = 1702160000000;

const fraughtHistory: IndexerInvoiceHistoryEntry[] = [
  {
    id: 10,
    freelancer: 'G1',
    payer: request.payer,
    amount: '10000000',
    due_date: 0,
    discount_rate: 300,
    status: 'Defaulted',
    funder: 'G2',
    funded_at: 1_700_000_000,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_001_000_000,
  },
  {
    id: 11,
    freelancer: 'G1',
    payer: request.payer,
    amount: '10010000',
    due_date: 0,
    discount_rate: 300,
    status: 'Defaulted',
    funder: 'G2',
    funded_at: 1_700_003_000,
    created_at: 1_700_003_000_000,
    updated_at: 1_700_004_000_000,
  },
  {
    id: 12,
    freelancer: 'G1',
    payer: request.payer,
    amount: '10005000',
    due_date: 0,
    discount_rate: 300,
    status: 'Pending',
    funder: null,
    funded_at: null,
    created_at: 1_700_006_000_000,
    updated_at: 1_700_006_500_000,
  },
];

const reputation: ReputationSnapshot = {
  address: request.payer,
  score: 86,
  totalPaid: 10_000_000n,
  invoiceCount: 4,
  lastActivity: 1_700_860_000,
  rank: 5,
};

describe('oracle verifier calculations', () => {
  it('normalizes amounts and timestamps', () => {
    expect(normalizeAmountToNumber('10000000')).toBe(10000000);
    expect(normalizeTimestampToMs(1_700_000_000)).toBe(1_700_000_000_000);
    expect(normalizeTimestampToMs(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('computes a strong trust score for healthy history', () => {
    // Anchored just past the fixture's newest timestamp so the data stays
    // inside maxOracleAgeMs. The previous value sat 240,000,000 ms past it, so
    // the assessment was always stale and `isVerified` could never be true.
    const assessment = assessOracleRequest({
      request,
      reputation,
      history: healthyHistory,
      nowMs: HEALTHY_LATEST_MS + 60_000,
      maxOracleAgeMs: 10_000_000,
    });

    expect(assessment.response.trustScore).toBeGreaterThan(60);
    expect(assessment.response.confidence).toBeGreaterThan(0.5);
    expect(assessment.response.isVerified).toBe(true);
    expect(assessment.response.historicalDefaultRate).toBeCloseTo(0.25, 2);
    expect(assessment.response.averageHistoricalAmount).toBe('11000000');
  });

  it('flags concentrated short-window activity as risk', () => {
    const assessment = assessOracleRequest({
      request,
      reputation,
      history: fraughtHistory,
      nowMs: 1_701_100_000_000,
      maxOracleAgeMs: 10_000_000,
    });

    expect(assessment.response.fraudSignals.length).toBeGreaterThan(0);
    expect(assessment.response.isVerified).toBe(false);
    expect(assessment.response.trustScore).toBeLessThan(70);
  });

  it('deduplicates concurrent verification requests through inflight caching', async () => {
    const { cache } = await createOracleCache();
    let historyCalls = 0;
    let reputationCalls = 0;

    const verifier = new OracleVerifier({
      cache,
      historyProvider: async () => {
        historyCalls += 1;
        return healthyHistory;
      },
      reputationProvider: async () => {
        reputationCalls += 1;
        return reputation;
      },
      cacheTtlSeconds: 300,
      maxOracleAgeMs: 10_000_000,
      now: () => 1_701_100_000_000,
    });

    const results = await Promise.all(Array.from({ length: 100 }, () => verifier.verify(request)));

    expect(results).toHaveLength(100);
    expect(historyCalls).toBe(1);
    expect(reputationCalls).toBe(1);
    expect(results[0].cacheHit).toBe(false);
    expect(results.slice(1).every((result) => result.cacheHit)).toBe(true);
  });
});
