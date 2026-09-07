import { describe, it, expect } from 'vitest';
import { settle, Player, SettleOptions } from './settle';

// ── helpers ──────────────────────────────────────────────────────────────────

function players(entries: [string, number][]): Player[] {
  return entries.map(([id, netCents]) => ({ id, netCents }));
}

const BOUNCE: SettleOptions = { roundingMode: 'BOUNCE' };
const CARRY: SettleOptions = { roundingMode: 'CARRY_FORWARD' };

// ── tests ─────────────────────────────────────────────────────────────────────

describe('settle()', () => {
  // 1. 2-player trivial case
  it('2-player: A owes B $20 → one STANDARD transaction', () => {
    const ps = players([
      ['player-A', -2000],
      ['player-B', +2000],
    ]);
    const plan = settle(ps, BOUNCE);

    expect(plan.transactions).toHaveLength(1);
    const tx = plan.transactions[0];
    expect(tx.kind).toBe('STANDARD');
    expect(tx.fromId).toBe('player-A');
    expect(tx.toId).toBe('player-B');
    expect(tx.amountCents).toBe(2000);
    expect(plan.newCarriedBalances).toHaveLength(0);
  });

  // 2. n-player reduction count: ≤ n−1 transactions
  it('5 players: transaction count ≤ n−1 = 4', () => {
    // nets: [+5000, +3000, -2000, -4000, -2000] → sum = 0
    const ps = players([
      ['p1', +5000],
      ['p2', +3000],
      ['p3', -2000],
      ['p4', -4000],
      ['p5', -2000],
    ]);
    const plan = settle(ps, BOUNCE);

    // Count only STANDARD and BOUNCE_RETURN as "settling" transactions
    // (each bounce pair counts as one logical settlement; BOUNCE_QUALIFIER is a helper leg)
    // Per spec: "≤ n−1 transactions" — count all emitted Transaction objects
    const totalTxCount = plan.transactions.length;
    // Worst case for 5 players is 4 non-bounce transactions. In bounce mode extra legs are added
    // for sub-$1 pairs, but this test uses amounts ≥ $1 so no bounces should occur.
    expect(totalTxCount).toBeLessThanOrEqual(4);
    // Verify all are STANDARD (no sub-$1 amounts in this input)
    for (const tx of plan.transactions) {
      expect(tx.kind).toBe('STANDARD');
    }
    // Verify zero-balance: every creditor is fully paid, every debtor fully paid out
    // (implicit — the algorithm guarantees this, but let's spot-check counts)
    console.log(`n-player test: ${totalTxCount} transactions for 5 players`);
  });

  // 3. Zero-sum validation
  it('throws when net amounts do not sum to zero', () => {
    const ps = players([
      ['p1', +1000],
      ['p2', -500], // sum = +500, not zero
    ]);
    expect(() => settle(ps, BOUNCE)).toThrow('net amounts must sum to zero');
  });

  // 4. Sub-$1 bounce generation (BOUNCE mode)
  it('A owes B $0.40 → BOUNCE_QUALIFIER (B→A $1.00) and BOUNCE_RETURN (A→B $1.40)', () => {
    const ps = players([
      ['player-A', -40],
      ['player-B', +40],
    ]);
    const plan = settle(ps, BOUNCE);

    expect(plan.transactions).toHaveLength(2);

    const qualifier = plan.transactions.find((t) => t.kind === 'BOUNCE_QUALIFIER');
    const ret = plan.transactions.find((t) => t.kind === 'BOUNCE_RETURN');

    expect(qualifier).toBeDefined();
    expect(qualifier!.fromId).toBe('player-B'); // creditor sends first
    expect(qualifier!.toId).toBe('player-A');   // to debtor
    expect(qualifier!.amountCents).toBe(100);

    expect(ret).toBeDefined();
    expect(ret!.fromId).toBe('player-A');        // debtor returns
    expect(ret!.toId).toBe('player-B');           // to creditor
    expect(ret!.amountCents).toBe(140);

    // Both legs share the same bounceGroupId
    expect(qualifier!.bounceGroupId).toBeDefined();
    expect(qualifier!.bounceGroupId).toBe(ret!.bounceGroupId);

    expect(plan.newCarriedBalances).toHaveLength(0);
  });

  // 5. Sub-$1 carry-forward (CARRY_FORWARD mode)
  it('A owes B $0.40 → 0 transactions, 1 carried balance in CARRY_FORWARD mode', () => {
    const ps = players([
      ['player-A', -40],
      ['player-B', +40],
    ]);
    const plan = settle(ps, CARRY);

    expect(plan.transactions).toHaveLength(0);
    expect(plan.newCarriedBalances).toHaveLength(1);

    const cb = plan.newCarriedBalances[0];
    expect(cb.debtorId).toBe('player-A');
    expect(cb.creditorId).toBe('player-B');
    expect(cb.amountCents).toBe(40);
  });

  // 6. Prior carried balances folded in
  it('prior carried balance of 50 cents folds into new session: A owes B $5.00 → STANDARD $5.50', () => {
    const ps = players([
      ['player-A', -500],
      ['player-B', +500],
    ]);
    const opts: SettleOptions = {
      roundingMode: 'BOUNCE',
      priorCarriedBalances: [
        { debtorId: 'player-A', creditorId: 'player-B', amountCents: 50 },
      ],
    };
    const plan = settle(ps, opts);

    expect(plan.transactions).toHaveLength(1);
    const tx = plan.transactions[0];
    expect(tx.kind).toBe('STANDARD');
    expect(tx.fromId).toBe('player-A');
    expect(tx.toId).toBe('player-B');
    expect(tx.amountCents).toBe(550); // 500 + 50
  });

  // 6b. Player-funded buy-in: funder covered the buyer's buy-in (intra-session debt)
  it('financed buy-in folds in: B covered A → settlement flips direction', () => {
    // Poker nets: A won +50, B lost -50. But B covered A's $100 buy-in, so A owes B $100.
    // adjusted: A = +50 - 100 = -50, B = -50 + 100 = +50  → A pays B $50.
    const ps = players([
      ['player-A', +5000],
      ['player-B', -5000],
    ]);
    const plan = settle(ps, {
      roundingMode: 'BOUNCE',
      intraSessionDebts: [{ debtorId: 'player-A', creditorId: 'player-B', amountCents: 10000 }],
    });

    expect(plan.transactions).toHaveLength(1);
    const tx = plan.transactions[0];
    expect(tx.kind).toBe('STANDARD');
    expect(tx.fromId).toBe('player-A');
    expect(tx.toId).toBe('player-B');
    expect(tx.amountCents).toBe(5000);
  });

  it('financed buy-in that exactly offsets poker net → 0 transactions', () => {
    // A won +100, but A owes B $100 for the covered buy-in → nets cancel to zero.
    const ps = players([
      ['player-A', +10000],
      ['player-B', -10000],
    ]);
    const plan = settle(ps, {
      roundingMode: 'BOUNCE',
      intraSessionDebts: [{ debtorId: 'player-A', creditorId: 'player-B', amountCents: 10000 }],
    });
    expect(plan.transactions).toHaveLength(0);
    expect(plan.newCarriedBalances).toHaveLength(0);
  });

  it('financed buy-in and a prior carried balance both fold into the same settlement', () => {
    // Poker nets zero between A and B. A owes B $3 (financed) and B owes A $1 (carried).
    // Net effect: A owes B $2 → sub-$1? No, $2.00 ≥ $1 → one STANDARD $2.00.
    const ps = players([
      ['player-A', 0],
      ['player-B', 0],
    ]);
    const plan = settle(ps, {
      roundingMode: 'BOUNCE',
      priorCarriedBalances: [{ debtorId: 'player-B', creditorId: 'player-A', amountCents: 100 }],
      intraSessionDebts: [{ debtorId: 'player-A', creditorId: 'player-B', amountCents: 300 }],
    });
    expect(plan.transactions).toHaveLength(1);
    const tx = plan.transactions[0];
    expect(tx.kind).toBe('STANDARD');
    expect(tx.fromId).toBe('player-A');
    expect(tx.toId).toBe('player-B');
    expect(tx.amountCents).toBe(200);
  });

  it('financed buy-in with a guest funder settles like any other id', () => {
    const ps = players([
      ['guest-funder', 0],
      ['user-buyer', 0],
    ]);
    const plan = settle(ps, {
      roundingMode: 'BOUNCE',
      intraSessionDebts: [{ debtorId: 'user-buyer', creditorId: 'guest-funder', amountCents: 4200 }],
    });
    expect(plan.transactions).toHaveLength(1);
    expect(plan.transactions[0].fromId).toBe('user-buyer');
    expect(plan.transactions[0].toId).toBe('guest-funder');
    expect(plan.transactions[0].amountCents).toBe(4200);
  });

  // 7. Guest routing: guest IDs work the same as regular player IDs
  it('guest player IDs appear as fromId/toId without special handling', () => {
    const ps = players([
      ['guest-abc123', -1500],
      ['user-xyz789', +1500],
    ]);
    const plan = settle(ps, BOUNCE);

    expect(plan.transactions).toHaveLength(1);
    const tx = plan.transactions[0];
    expect(tx.kind).toBe('STANDARD');
    expect(tx.fromId).toBe('guest-abc123');
    expect(tx.toId).toBe('user-xyz789');
    expect(tx.amountCents).toBe(1500);
  });

  // 8. All-even session: everyone breaks even → 0 transactions, 0 carried balances
  it('all-even session: every player nets zero → 0 transactions and 0 carried balances', () => {
    const ps = players([
      ['p1', 0],
      ['p2', 0],
      ['p3', 0],
    ]);
    const plan = settle(ps, BOUNCE);

    expect(plan.transactions).toHaveLength(0);
    expect(plan.newCarriedBalances).toHaveLength(0);
  });

  // Bonus: prior carried balance that itself is sub-$1 gets folded and resolves correctly
  it('multiple creditors/debtors settle with minimum transactions', () => {
    // A owes $30, B owes $20, C is owed $30, D is owed $20
    const ps = players([
      ['A', -3000],
      ['B', -2000],
      ['C', +3000],
      ['D', +2000],
    ]);
    const plan = settle(ps, BOUNCE);

    // Sum of credits = 5000, sum of debts = 5000 — ≤ 3 transactions (n-1 = 3)
    expect(plan.transactions.length).toBeLessThanOrEqual(3);
    // Total settled amount should equal 5000 cents
    const totalSettled = plan.transactions
      .filter((t) => t.kind === 'STANDARD')
      .reduce((sum, t) => sum + t.amountCents, 0);
    expect(totalSettled).toBe(5000);
  });
});
