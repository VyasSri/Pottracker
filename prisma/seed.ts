import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      displayName: "Alice Chen",
      zelleHandle: "alice@example.com",
      dashboardPublic: true,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      displayName: "Bob Martinez",
      zelleHandle: "5125550101",
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: "carol@example.com" },
    update: {},
    create: {
      email: "carol@example.com",
      displayName: "Carol Kim",
      zelleHandle: "carol@example.com",
    },
  });

  const david = await prisma.user.upsert({
    where: { email: "david@example.com" },
    update: {},
    create: {
      email: "david@example.com",
      displayName: "David Okafor",
      zelleHandle: "5125550202",
    },
  });

  const eva = await prisma.user.upsert({
    where: { email: "eva@example.com" },
    update: {},
    create: {
      email: "eva@example.com",
      displayName: "Eva Patel",
      zelleHandle: "eva@example.com",
    },
  });

  const allUsers = [alice, bob, carol, david, eva];
  console.log(`Upserted ${allUsers.length} users`);

  // ── 2. Group ──────────────────────────────────────────────────────────────
  const group = await prisma.group.upsert({
    where: { inviteCode: "tuesday-nights-seed" },
    update: {},
    create: {
      name: "Tuesday Night Poker",
      inviteCode: "tuesday-nights-seed",
      createdById: alice.id,
    },
  });
  console.log(`Upserted group: ${group.name}`);

  // ── 3. Group Members ──────────────────────────────────────────────────────
  const memberDefs: Array<{ userId: string; role: string }> = [
    { userId: alice.id, role: "HOST_CAPABLE" },
    { userId: bob.id,   role: "HOST_CAPABLE" },
    { userId: carol.id, role: "MEMBER" },
    { userId: david.id, role: "MEMBER" },
    { userId: eva.id,   role: "MEMBER" },
  ];

  for (const m of memberDefs) {
    await prisma.groupMember.upsert({
      where: { userId_groupId: { userId: m.userId, groupId: group.id } },
      update: {},
      create: { userId: m.userId, groupId: group.id, role: m.role },
    });
  }
  console.log("Upserted group members");

  // ── 4. Helper: minimum cash-flow settlement ───────────────────────────────
  /**
   * Runs minimum cash-flow algorithm on a list of (sessionPlayerId, netCents)
   * pairs and writes SettlementTransaction rows, handling the sub-$1 bounce.
   * All amounts in integer cents.
   */
  async function settleSession(
    sessionId: string,
    confirmedAt: Date,
    balances: Array<{ spId: string; netCents: number }>
  ) {
    // Verify zero-sum
    const sum = balances.reduce((acc, b) => acc + b.netCents, 0);
    if (sum !== 0) throw new Error(`Session ${sessionId}: balances sum to ${sum}, expected 0`);

    type Entry = { spId: string; amount: number };
    const creditors: Entry[] = balances
      .filter((b) => b.netCents > 0)
      .map((b) => ({ spId: b.spId, amount: b.netCents }))
      .sort((a, b) => b.amount - a.amount);
    const debtors: Entry[] = balances
      .filter((b) => b.netCents < 0)
      .map((b) => ({ spId: b.spId, amount: -b.netCents }))
      .sort((a, b) => b.amount - a.amount);

    while (creditors.length > 0 && debtors.length > 0) {
      const creditor = creditors[0];
      const debtor = debtors[0];
      const amount = Math.min(creditor.amount, debtor.amount);

      if (amount >= 100) {
        // STANDARD
        await prisma.settlementTransaction.create({
          data: {
            sessionId,
            fromPlayerId: debtor.spId,
            toPlayerId: creditor.spId,
            amountCents: amount,
            kind: "STANDARD",
            payerConfirmed: true,
            payeeConfirmed: true,
            confirmedAt,
          },
        });
      } else if (amount > 0) {
        // Sub-$1 bounce
        const bounceGroupId = `bounce-${sessionId.slice(-8)}-${debtor.spId.slice(-4)}-${creditor.spId.slice(-4)}`;
        // Step 1: creditor sends debtor $1.00
        await prisma.settlementTransaction.create({
          data: {
            sessionId,
            fromPlayerId: creditor.spId,
            toPlayerId: debtor.spId,
            amountCents: 100,
            kind: "BOUNCE_QUALIFIER",
            bounceGroupId,
            payerConfirmed: true,
            payeeConfirmed: true,
            confirmedAt,
          },
        });
        // Step 2: debtor sends creditor original debt + $1.00
        await prisma.settlementTransaction.create({
          data: {
            sessionId,
            fromPlayerId: debtor.spId,
            toPlayerId: creditor.spId,
            amountCents: amount + 100,
            kind: "BOUNCE_RETURN",
            bounceGroupId,
            payerConfirmed: true,
            payeeConfirmed: true,
            confirmedAt,
          },
        });
      }

      creditor.amount -= amount;
      debtor.amount -= amount;
      if (creditor.amount === 0) creditors.shift();
      if (debtor.amount === 0) debtors.shift();
    }
  }

  /**
   * Creates a complete, SETTLED session with buy-ins and settlement transactions.
   * players: array of { userId, buyIns (array of cent amounts), cashOutCents }
   * Chip conservation: sum(buyIns) must equal sum(cashOutCents) across all players.
   */
  async function createSettledSession(params: {
    hostId: string;
    defaultBuyInCents: number;
    startedAt: Date;
    endedAt: Date;
    players: Array<{
      userId: string;
      buyIns: number[];       // individual buy-in amounts in cents
      cashOutCents: number;
    }>;
  }) {
    // Validate chip conservation
    const totalIn = params.players.reduce((s, p) => s + p.buyIns.reduce((a, b) => a + b, 0), 0);
    const totalOut = params.players.reduce((s, p) => s + p.cashOutCents, 0);
    if (totalIn !== totalOut) {
      throw new Error(`Chip conservation failed: in=${totalIn}, out=${totalOut}`);
    }

    const session = await prisma.session.create({
      data: {
        groupId: group.id,
        hostId: params.hostId,
        status: "SETTLED",
        defaultBuyInCents: params.defaultBuyInCents,
        roundingMode: "BOUNCE",
        startedAt: params.startedAt,
        endedAt: params.endedAt,
      },
    });

    const balances: Array<{ spId: string; netCents: number }> = [];

    for (const p of params.players) {
      const sp = await prisma.sessionPlayer.create({
        data: {
          sessionId: session.id,
          userId: p.userId,
          cashOutCents: p.cashOutCents,
        },
      });

      for (const amount of p.buyIns) {
        await prisma.buyIn.create({
          data: { sessionPlayerId: sp.id, amountCents: amount },
        });
      }

      const totalBuyIn = p.buyIns.reduce((a, b) => a + b, 0);
      balances.push({ spId: sp.id, netCents: p.cashOutCents - totalBuyIn });
    }

    await settleSession(session.id, params.endedAt, balances);
    return session;
  }

  // ── 5. Sessions ───────────────────────────────────────────────────────────
  // All amounts in cents. Chip conservation: sum(buyIns) == sum(cashOuts).

  // Session 1 — Alice wins big, Eva busts (Jan 7)
  // Total in: 2000*4 + 4000 (bob rebuy) = 12000
  // Total out: 5500+500+1500+2500+2000 = 12000 ✓
  await createSettledSession({
    hostId: alice.id,
    defaultBuyInCents: 2000,
    startedAt: new Date("2026-01-07T19:00:00Z"),
    endedAt:   new Date("2026-01-07T23:30:00Z"),
    players: [
      { userId: alice.id, buyIns: [2000],       cashOutCents: 5500 }, // +3500
      { userId: bob.id,   buyIns: [2000, 2000], cashOutCents: 500  }, // -3500
      { userId: carol.id, buyIns: [2000],       cashOutCents: 1500 }, // -500
      { userId: david.id, buyIns: [2000],       cashOutCents: 2500 }, // +500
      { userId: eva.id,   buyIns: [2000],       cashOutCents: 2000 }, // 0
    ],
  });

  // Session 2 — Bob wins, Carol rebuys (Jan 21)
  // Total in: 2000+2000+4000+2000+2000 = 12000
  // Total out: 1000+4500+2000+1500+3000 = 12000 ✓
  await createSettledSession({
    hostId: bob.id,
    defaultBuyInCents: 2000,
    startedAt: new Date("2026-01-21T19:00:00Z"),
    endedAt:   new Date("2026-01-21T23:00:00Z"),
    players: [
      { userId: alice.id, buyIns: [2000],       cashOutCents: 1000 }, // -1000
      { userId: bob.id,   buyIns: [2000],       cashOutCents: 4500 }, // +2500
      { userId: carol.id, buyIns: [2000, 2000], cashOutCents: 2000 }, // -2000
      { userId: david.id, buyIns: [2000],       cashOutCents: 1500 }, // -500
      { userId: eva.id,   buyIns: [2000],       cashOutCents: 3000 }, // +1000
    ],
  });

  // Session 3 — Carol wins big, David rebuys (Feb 4)
  // Total in: 2000+2000+2000+4000+2000 = 12000
  // Total out: 1500+1500+5000+2500+1500 = 12000 ✓
  await createSettledSession({
    hostId: alice.id,
    defaultBuyInCents: 2000,
    startedAt: new Date("2026-02-04T19:00:00Z"),
    endedAt:   new Date("2026-02-04T22:45:00Z"),
    players: [
      { userId: alice.id, buyIns: [2000],       cashOutCents: 1500 }, // -500
      { userId: bob.id,   buyIns: [2000],       cashOutCents: 1500 }, // -500
      { userId: carol.id, buyIns: [2000],       cashOutCents: 5000 }, // +3000
      { userId: david.id, buyIns: [2000, 2000], cashOutCents: 2500 }, // -1500
      { userId: eva.id,   buyIns: [2000],       cashOutCents: 1500 }, // -500
    ],
  });

  // Session 4 — Eva dominates, Alice rebuys twice (Feb 18)
  // Total in: 6000+2500+2500+2500+2500 = 16000
  // Total out: 0+2000+3000+1500+9500 = 16000 ✓
  await createSettledSession({
    hostId: bob.id,
    defaultBuyInCents: 2500,
    startedAt: new Date("2026-02-18T19:00:00Z"),
    endedAt:   new Date("2026-02-18T23:30:00Z"),
    players: [
      { userId: alice.id, buyIns: [2500, 2500, 1000], cashOutCents: 0    }, // -6000
      { userId: bob.id,   buyIns: [2500],             cashOutCents: 2000 }, // -500
      { userId: carol.id, buyIns: [2500],             cashOutCents: 3000 }, // +500
      { userId: david.id, buyIns: [2500],             cashOutCents: 1500 }, // -1000
      { userId: eva.id,   buyIns: [2500],             cashOutCents: 9500 }, // +7000
    ],
  });

  // Session 5 — Close game, small margins (Mar 4)
  // Total in: 2000*5 = 10000
  // Total out: 2400+2300+1900+1800+1600 = 10000 ✓
  await createSettledSession({
    hostId: carol.id,
    defaultBuyInCents: 2000,
    startedAt: new Date("2026-03-04T19:00:00Z"),
    endedAt:   new Date("2026-03-04T22:30:00Z"),
    players: [
      { userId: alice.id, buyIns: [2000], cashOutCents: 2400 }, // +400
      { userId: bob.id,   buyIns: [2000], cashOutCents: 2300 }, // +300
      { userId: carol.id, buyIns: [2000], cashOutCents: 1900 }, // -100
      { userId: david.id, buyIns: [2000], cashOutCents: 1800 }, // -200
      { userId: eva.id,   buyIns: [2000], cashOutCents: 1600 }, // -400
    ],
  });

  // Session 6 — David wins, Alice and Bob rebuy (Mar 18)
  // Total in: 4000+4000+2000+2000+2000 = 14000
  // Total out: 1000+2000+1000+8000+2000 = 14000 ✓
  await createSettledSession({
    hostId: david.id,
    defaultBuyInCents: 2000,
    startedAt: new Date("2026-03-18T19:00:00Z"),
    endedAt:   new Date("2026-03-18T23:45:00Z"),
    players: [
      { userId: alice.id, buyIns: [2000, 2000], cashOutCents: 1000 }, // -3000
      { userId: bob.id,   buyIns: [2000, 2000], cashOutCents: 2000 }, // -2000
      { userId: carol.id, buyIns: [2000],       cashOutCents: 1000 }, // -1000
      { userId: david.id, buyIns: [2000],       cashOutCents: 8000 }, // +6000
      { userId: eva.id,   buyIns: [2000],       cashOutCents: 2000 }, // 0
    ],
  });

  console.log("Created 6 sessions with buy-ins and settlement transactions");

  // ── 6. Sample Alerts ──────────────────────────────────────────────────────
  // Delete existing seed alerts to keep idempotent re-runs clean
  await prisma.alert.deleteMany({
    where: {
      userId: { in: allUsers.map((u) => u.id) },
      body: { contains: "seed" },
    },
  });

  await prisma.alert.createMany({
    data: [
      {
        userId: alice.id,
        type: "SESSION_ENDED",
        title: "Session ended — net: +$35.00",
        body: "Tuesday Night Poker (Jan 7) has ended. You are owed $35.00. [seed]",
        link: "/sessions",
      },
      {
        userId: bob.id,
        type: "PAYMENT_REMINDER",
        title: "Payment reminder: $35.00 to Alice",
        body: "Alice is waiting on your Zelle payment of $35.00 from the Jan 7 session. [seed]",
        link: "/sessions",
      },
      {
        userId: eva.id,
        type: "SETTLEMENT_READY",
        title: "Settlement ready for Mar 4 session",
        body: "Payments have been calculated for Tuesday Night Poker (Mar 4). You owe $4.00. [seed]",
        link: "/sessions",
      },
    ],
  });
  console.log("Created sample alerts");

  console.log("\nSeed complete!");
  console.log("Summary:");
  console.log("  Users: 5 (alice, bob, carol, david, eva)");
  console.log("  Groups: 1 (Tuesday Night Poker)");
  console.log("  Sessions: 6 (all SETTLED)");
  console.log("  Alerts: 3 sample notifications");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
