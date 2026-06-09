export type RoundingMode = 'BOUNCE' | 'CARRY_FORWARD';

export interface Player {
  id: string;
  netCents: number; // positive = creditor, negative = debtor
}

export interface CarriedBalance {
  debtorId: string;
  creditorId: string;
  amountCents: number;
}

export interface SettleOptions {
  roundingMode: RoundingMode;
  // Existing carried balances from prior sessions to fold into this settlement
  priorCarriedBalances?: CarriedBalance[];
}

export type TransactionKind = 'STANDARD' | 'BOUNCE_QUALIFIER' | 'BOUNCE_RETURN';

export interface Transaction {
  kind: TransactionKind;
  fromId: string; // debtor (payer)
  toId: string;   // creditor (payee)
  amountCents: number;
  bounceGroupId?: string; // set on both legs of a bounce pair
}

export interface SettlementPlan {
  transactions: Transaction[];
  newCarriedBalances: CarriedBalance[]; // only populated when roundingMode = CARRY_FORWARD
}

export function settle(players: Player[], opts: SettleOptions): SettlementPlan {
  // 1. Input validation: net amounts must sum to zero
  const sum = players.reduce((acc, p) => acc + p.netCents, 0);
  if (sum !== 0) {
    throw new Error('net amounts must sum to zero');
  }

  // 2. Fold in prior carried balances by adjusting net positions
  const netMap = new Map<string, number>();
  for (const p of players) {
    netMap.set(p.id, p.netCents);
  }

  if (opts.priorCarriedBalances) {
    for (const cb of opts.priorCarriedBalances) {
      // creditor is owed more, debtor owes more
      const creditorNet = netMap.get(cb.creditorId) ?? 0;
      const debtorNet = netMap.get(cb.debtorId) ?? 0;
      netMap.set(cb.creditorId, creditorNet + cb.amountCents);
      netMap.set(cb.debtorId, debtorNet - cb.amountCents);
    }
  }

  // 3. Minimum cash flow algorithm
  // Build mutable lists of creditors and debtors
  interface Entry {
    id: string;
    amount: number; // always positive
  }

  const creditors: Entry[] = [];
  const debtors: Entry[] = [];

  for (const [id, net] of netMap.entries()) {
    if (net > 0) {
      creditors.push({ id, amount: net });
    } else if (net < 0) {
      debtors.push({ id, amount: -net });
    }
    // net === 0: skip
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions: Transaction[] = [];
  const newCarriedBalances: CarriedBalance[] = [];

  while (creditors.length > 0 && debtors.length > 0) {
    const creditor = creditors[0];
    const debtor = debtors[0];

    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount === 0) {
      // Shouldn't happen, but guard against infinite loops
      creditors.shift();
      debtors.shift();
      continue;
    }

    // 4. Sub-$1 handling
    if (amount < 100) {
      if (opts.roundingMode === 'BOUNCE') {
        // Emit a bounce pair
        const bounceGroupId = `bounce-${debtor.id.slice(-6)}-${creditor.id.slice(-6)}`;
        // BOUNCE_QUALIFIER: creditor sends debtor $1.00
        transactions.push({
          kind: 'BOUNCE_QUALIFIER',
          fromId: creditor.id,
          toId: debtor.id,
          amountCents: 100,
          bounceGroupId,
        });
        // BOUNCE_RETURN: debtor sends creditor amount + $1.00
        transactions.push({
          kind: 'BOUNCE_RETURN',
          fromId: debtor.id,
          toId: creditor.id,
          amountCents: amount + 100,
          bounceGroupId,
        });
      } else {
        // CARRY_FORWARD mode: store as carried balance, no transaction
        newCarriedBalances.push({
          debtorId: debtor.id,
          creditorId: creditor.id,
          amountCents: amount,
        });
      }
    } else {
      // 5. Amounts >= $1.00: emit as STANDARD
      transactions.push({
        kind: 'STANDARD',
        fromId: debtor.id,
        toId: creditor.id,
        amountCents: amount,
      });
    }

    // Reduce balances
    creditor.amount -= amount;
    debtor.amount -= amount;

    // Remove exhausted entries
    if (creditor.amount === 0) {
      creditors.shift();
    }
    if (debtor.amount === 0) {
      debtors.shift();
    }

    // Re-sort to maintain descending order (insertion sort step)
    // After reduction, head element may be smaller — move it to correct position
    if (creditors.length > 1 && creditors[0].amount < creditors[1].amount) {
      creditors.sort((a, b) => b.amount - a.amount);
    }
    if (debtors.length > 1 && debtors[0].amount < debtors[1].amount) {
      debtors.sort((a, b) => b.amount - a.amount);
    }
  }

  return { transactions, newCarriedBalances };
}
