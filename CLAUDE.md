# CLAUDE.md — Poker Ledger (working title)

## Project Overview

A full-stack web app for home poker groups. Tracks buy-ins and cash-outs per session, computes optimal debt settlement at session end, generates Zelle payment instructions, and maintains long-term per-player statistics across multiple groups.

**Primary goals:**
1. Resume-grade project demonstrating relational data modeling, algorithmic optimization (minimum cash flow), auth, and full-stack TypeScript
2. Genuinely usable by real poker groups at $0 infrastructure cost

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) + TypeScript | SSR, API routes, single deployable |
| Styling | Tailwind CSS | |
| Database | PostgreSQL via Supabase (free tier) | |
| ORM | Prisma | Schema-first, type-safe queries |
| Auth | Supabase Auth (or NextAuth if preferred) | Email/password + OAuth (Google) |
| Charts | Recharts | Stats dashboard visualizations |
| Hosting | Vercel (free tier) | |
| Payments | Zelle deep links + in-app confirmation | No payment APIs in MVP |
| Notifications | In-platform alerts (DB-backed) | NO email/push — alerts section in dashboard |

**Cost constraint: everything must run on free tiers. Do not introduce paid services.**

---

## Architecture Principles

1. **Abstract the payment layer.** All payment-instruction generation goes through a `PaymentProvider` interface. MVP ships one implementation: `ZelleDeepLinkProvider`. Stripe (test mode) will be added post-MVP as a second implementation — design for this, do not build it yet.
2. **Event-sourced money movements.** Never store only running totals. Every buy-in, cash-out, and payment confirmation is an immutable row. Totals and stats are derived (computed or cached, but always re-derivable).
3. **Server-side money math only.** All settlement and stat calculations run server-side. Use integer cents everywhere — never floats for currency.
4. **No live/realtime session tracking.** Sessions are simple state machines (see lifecycle). No WebSockets needed.

---

## Data Model (Prisma schema outline)

```
User
  id, email, displayName, avatarUrl?
  zelleHandle?        // phone or email for deep links
  dashboardPublic     Boolean @default(false)
  createdAt

Group
  id, name, inviteCode (unique, regenerable), createdById
  createdAt

GroupMember
  userId, groupId, role (HOST_CAPABLE | MEMBER), joinedAt
  @@unique([userId, groupId])

Session
  id, groupId, hostId (User)
  status              DRAFT | ACTIVE | ENDED | SETTLED
  defaultBuyInCents   Int
  roundingMode        BOUNCE | CARRY_FORWARD   // host setting, see Settlement
  startedAt?, endedAt?

SessionPlayer
  id, sessionId
  userId?             // null for guests
  guestName?          // required when userId is null
  leftEarly           Boolean @default(false)
  cashOutCents?       // recorded by host at exit or session end

BuyIn
  id, sessionPlayerId, amountCents, createdAt
  // rebuys = multiple rows per SessionPlayer

SettlementTransaction
  id, sessionId
  fromPlayerId, toPlayerId   // SessionPlayer refs
  amountCents
  kind                STANDARD | BOUNCE_QUALIFIER | BOUNCE_RETURN
  bounceGroupId?      // links the two legs of a micro-settlement bounce
  payerConfirmed      Boolean @default(false)
  payeeConfirmed      Boolean @default(false)
  confirmedAt?

CarriedBalance
  id, groupId, debtorUserId, creditorUserId, amountCents
  // sub-$1 residue when roundingMode = CARRY_FORWARD; folded into next session's settlement

Alert
  id, userId, type, title, body, link?, readAt?, createdAt
  // types: SESSION_ENDED, SETTLEMENT_READY, PAYMENT_CONFIRMED,
  //        GROUP_INVITE, PAYMENT_REMINDER
```

---

## Core Feature Spec

### 1. Auth & Profiles
- Email/password + Google OAuth
- Profile: display name, avatar, **Zelle handle** (phone/email) used to pre-populate deep links
- Dashboard privacy toggle: private by default; public makes the personal stats page shareable via link

### 2. Groups
- Create group → get shareable invite code/link; code regenerable by creator
- Users can belong to **multiple groups**
- Group page: member list, session history, **group leaderboard** (all-time net P/L per member, filterable by date range)
- Leaderboards are always visible to all group members regardless of individual privacy settings

### 3. Session Lifecycle
```
DRAFT → ACTIVE → ENDED → SETTLED
```
- **DRAFT:** host creates session in a group, sets default buy-in amount and rounding mode, adds players (members and/or guests)
- **ACTIVE:** host records buy-ins (initial + rebuys, each a separate BuyIn row). Players can be added mid-session.
- **Mid-session exit:** host records the player's cash-out, marks `leftEarly = true`. Player is excluded from further buy-ins but **included in settlement**.
- **ENDED:** **only the host can end a session.** Host records remaining cash-outs. Validation: total cash-outs must equal total buy-ins (chip conservation) — block ending until balanced, show the discrepancy amount.
- **SETTLED:** all settlement transactions have both payer + payee confirmation.

### 4. Guest Players
- Host adds a guest by name only (no account)
- Guest buy-ins/cash-outs recorded normally by host
- Settlement involving guests routes through the host: guest debts/credits are displayed with instructions for the host to collect/distribute in person
- Guest stats are session-scoped only (no long-term tracking)
- Future-proofing: if a guest later registers, allow host to link guest records to the new account (post-MVP, but don't make the schema hostile to it)

### 5. Debt Settlement Algorithm — the centerpiece
Implement as a **pure, exported, unit-tested function**:

```ts
settle(players: { id: string; netCents: number }[], opts: SettleOptions): SettlementPlan
```

- **Minimum cash flow algorithm:** repeatedly match the largest creditor with the largest debtor, emit a transaction for min(|credit|, |debt|), repeat until all balances are zero. Guarantees ≤ n−1 transactions for n players.
- Input validation: net amounts must sum to zero (guaranteed by chip-conservation check at session end).
- **$1 Zelle minimum handling — the micro-settlement bounce:**
  - If a computed transaction is ≥ $1.00 → emit as `STANDARD`.
  - If a computed transaction is < $1.00 (e.g., A owes B $0.40), emit a **bounce pair** sharing a `bounceGroupId`:
    1. `BOUNCE_QUALIFIER`: B sends A **$1.00** (temporarily raising A's debt to B to $1.40)
    2. `BOUNCE_RETURN`: A sends B **$1.40** (clears the original $0.40 and returns the qualifier)
  - Both legs satisfy Zelle's $1 minimum. The bounce involves **only the two parties to the original debt** — no third player is pulled in.
  - The UI must present the bounce as a clearly ordered two-step instruction ("Step 1: B sends A $1.00. Step 2: A sends B $1.40.") and explain why in one sentence.
  - The settlement is only complete when **both legs** are confirmed.
- **Alternative mode (host setting): `CARRY_FORWARD`** — sub-$1 transactions are stored as `CarriedBalance` rows and automatically folded into the same pair's net positions in the group's next session settlement. Default mode is `BOUNCE`.
- Unit tests required: 2-player trivial case, n-player reduction count, zero-sum validation, sub-$1 bounce generation, carry-forward folding, guest routing.

### 6. Payments (trust-based)
- For each `STANDARD`/bounce transaction, generate a **Zelle deep link** pre-filled with the payee's Zelle handle and amount; fall back to copyable instructions (handle + amount) if the deep link can't open
- Two-sided confirmation: payer taps "I sent it," payee taps "I received it" → transaction confirmed
- **No dispute system.** Trust-based among friends. (Schema note: keep confirmation timestamps so a dispute feature is possible later.)
- Session auto-transitions to `SETTLED` when every transaction is fully confirmed

### 7. In-Platform Alerts (no email, no push)
- Dedicated **Alerts section** in the dashboard nav with unread badge count
- Alert events: session ended (with your P/L + what you owe / are owed), settlement ready, payment marked sent to you, payment confirmed, group invite, optional payment reminder (payee can nudge once per transaction per 24h)
- Mark-as-read individually and mark-all-read; alerts deep-link to the relevant session/transaction

### 8. Stats & Dashboards (all in MVP)
**Personal dashboard (cross-group aggregate, private by default):**
- Net P/L (all-time and per time range)
- **ROI %** = totalNet / totalBuyIns × 100 (define once in a shared util, use everywhere)
- **Longest positive streak** = max run of consecutive sessions (ordered by `endedAt`) with net > 0
- **Monthly earnings** bar chart (Recharts), Pikkit-style — green/red bars per month
- **Per-group breakdown:** bar chart of net P/L by group, colored positive/negative — "which groups do I make money in"
- Session history table with per-session net

**Group leaderboard:**
- Ranked net P/L over selectable range (all-time / year / month)
- Sessions played, ROI % per member

**Privacy rules:** personal dashboard visible only to the owner unless made public; group-scoped numbers always visible within that group.

### 9. UX Surface Map
```
/login, /signup
/dashboard            → personal stats + alerts badge
/alerts               → alert feed
/groups               → my groups list + create/join
/groups/[id]          → leaderboard, members, sessions, "new session" (any member can host)
/sessions/[id]        → state-dependent view:
                          ACTIVE → buy-in/cash-out controls (host), live roster
                          ENDED  → settlement plan, payment links, confirmations
                          SETTLED→ summary + final P/L
/profile              → Zelle handle, privacy toggle
/u/[handle]           → public dashboard (only if user enabled it)
```

---

## Explicitly Out of Scope (post-MVP)
- Stripe integration (test mode) — `PaymentProvider` interface exists, second implementation comes later
- Venmo API — dropped entirely (partner-restricted)
- Email/push notifications — alerts are in-platform only
- Disputes/escrow
- Live/realtime session tracking, WebSockets
- Native mobile app
- Guest→account record linking (schema supports it; no UI yet)

---

## Engineering Standards
- TypeScript strict mode; no `any` in money paths
- All currency as **integer cents**; format at the display layer only
- Settlement algorithm: pure function + unit tests (Vitest) before any UI work
- Zod validation on all API inputs
- Prisma migrations checked into repo
- Seed script: 1 group, 5 users (one with a guest), 6 historical sessions with varied outcomes — so stats/leaderboards render with realistic data in dev

## Build Order
1. Schema + migrations + seed script
2. **Settlement algorithm + tests** (do this before any UI — it's the interview centerpiece)
3. Auth + profiles
4. Groups (create/join/invite)
5. Session lifecycle (draft → active → ended) incl. guests, rebuys, mid-session exit, chip-conservation check
6. Settlement UI + Zelle deep links + confirmations + bounce flow
7. Alerts system
8. Stats: personal dashboard, group leaderboard, charts
9. Privacy/public dashboard
10. Polish: empty states, loading states, mobile responsiveness

## Resume Bullet Targets (write the app so these are true)
- Reduced multi-party debt settlement from O(n²) pairwise payments to ≤ n−1 transactions by implementing a minimum cash flow algorithm with full unit-test coverage
- Engineered a two-step "qualifying payment" protocol to settle sub-minimum micro-debts within Zelle's $1 transaction floor
- Modeled event-sourced financial ledgers (buy-ins, cash-outs, settlements) in PostgreSQL/Prisma with integer-cent precision and zero-sum validation
- Built cross-group analytics dashboards (ROI %, streak detection, monthly P/L) with privacy-scoped visibility controls
