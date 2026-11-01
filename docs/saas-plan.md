# LeeView as a paid product

The plan for turning LeeView into a SaaS: what to sell, how credits work, how the screens change, and how a user actually gets better. Nothing here is built yet. Prices are proposals until Phase 0 gives real cost numbers.

## The position

LeeView sells one outcome: **you get better at talking through a problem under pressure.** LeetCode already teaches the solving. Every decision below should make that improvement more visible, because visible improvement is what people renew for.

Three decisions shape everything else:

1. **Sell interviews, not minutes or tokens.** One credit is one interview. Per-minute billing would match our costs, but it makes people rush, and rushing is the habit we're trying to fix.
2. **Offer packs as well as a subscription.** Interview prep comes in bursts: heavy for six weeks, then nothing. Subscription-only pricing loses those people the day they get an offer. A pack gives them a way to come back.
3. **Never charge for a broken interview.** Voice products fail in ways that aren't the user's fault. A dropped connection that costs a credit is the fastest way to lose trust.

## Plans

| Plan | Price (proposal) | Includes | For |
| --- | --- | --- | --- |
| Free | $0 | 3 interviews on sign-up, then 1 a month. Full debrief on all of them. | Trying it and seeing a real score |
| Pro | $19 a month | 20 interviews a month, unused ones roll over once, skill trends and focus plans | Someone actively preparing |
| Pack | $12 for 5 interviews | Credits that don't expire. Same features as Pro while credits remain. | Occasional practice, returning users |

Free users get the full debrief. It's the product's best demonstration, so limit how many interviews they get, never how good each one is.

### Unit economics

We record no provider usage today, so these prices are untested. For each interview:

```
cost = Deepgram Nova-3 minutes x its rate      (speech to text, whole interview)
     + characters spoken x Aura-2 rate         (interviewer's voice)
     + LLM input and output tokens x its rate  (each turn, plus the debrief)
```

The target is at least 70% gross margin on Pro at full use. If a 45-minute interview costs more than about $0.25, change the Pro allowance or the time cap, not the free debrief. Also confirm that the NVIDIA NIM and OpenRouter terms allow commercial use at this volume.

## How credits work

A credit moves through three steps, so a failed interview costs nothing:

```
POST /sessions          reserve 1 credit, or return 402 out_of_credits
first real answer       capture it: the interview has genuinely started
ended early or failed   release it back to the balance
```

- **Captured** once the user has spoken for two minutes in total. Before that, leaving is free.
- **Time cap:** 45 minutes. The interviewer gives a spoken warning at 40 and wraps up at 45, which also protects cost.
- **Failures on our side** (provider error, debrief that never generates) refund automatically, and the debrief says so.
- **Rolled-over credits are spent first**, then monthly ones, then packs, so what expires goes first.

### Data model

Use an append-only ledger. A stored balance can drift and can't explain itself; a ledger answers every support question.

```sql
credit_ledger (
  id, user_id, delta INTEGER, reason TEXT,   -- grant, reserve, release, refund, purchase, expire
  session_id NULL, source TEXT,              -- free, monthly, rollover, pack
  expires_at NULL, idempotency_key UNIQUE, created_at
)
subscriptions (user_id, plan, status, provider_customer_id, provider_subscription_id, current_period_end)
session_usage (session_id, stt_seconds, tts_characters, llm_input_tokens, llm_output_tokens, cost_usd)
```

Users can read their own ledger through row level security. Only the backend's service role writes to it. Reserving must go through one database function that locks the user's rows, so two tabs can't spend the same credit. `idempotency_key` makes payment webhooks safe to deliver twice.

### Where it plugs in

| Change | Place |
| --- | --- |
| Reserve, return 402 | `app/backend/src/main.py`, `POST /sessions` |
| Capture, release, time cap | `app/backend/src/websocket/handler.py` |
| Count speech and voice usage | `app/backend/src/services/deepgram.py` |
| Count tokens | `app/backend/src/services/llm/base.py` and both providers |
| Refund on failed debrief | `app/backend/src/debrief/engine.py` |
| Payment webhooks | new `POST /webhooks/billing` |
| Credits left, out-of-credits card | `app/extension/src/components/ReadyCard.tsx` and a new card |

For payments, start with a merchant of record such as Paddle or Lemon Squeezy, so global sales tax isn't your job. Check that the provider supports payouts in your country before choosing.

## Layout system

The current system stays: the left rail, LeetCode's dark surfaces, Hanken Grotesk, and JetBrains Mono for code only. These rules keep it premium as it grows.

- **Orange marks the one thing to do next.** At most one solid orange element per screen, plus the active rail item. It never means a score or a plan tier.
- **Status colours are for status.** Teal, yellow and red are reserved for scores and difficulty.
- **Paying feels calm.** No countdowns, crossed-out prices, or nagging. Premium products don't beg.
- **Screens answer one question.** Overview: what should I do now? Analytics: am I improving? History: what happened? Plan and credits: what do I have left?

### Navigation

The rail already takes groups, so billing is a new entry in `src/lib/nav.tsx`, not a redesign:

```
Practice   Overview, Analytics, History
Account    Plan and credits, Profile
```

### Credits in the dashboard

A meter that's always visible makes people anxious about using the product. So the rail shows nothing until two interviews remain, then a quiet line above the avatar. At zero it becomes the screen's single orange action.

```
 Overview
 +----------------------------------------------+
 | Up next: Course Schedule        [ Start ]    |   normal state
 +----------------------------------------------+

 +----------------------------------------------+
 | You've used this month's interviews.         |
 | 12 days until 20 more.   [ Get 5 interviews ]|   out of credits
 +----------------------------------------------+
```

### Plan and credits page (`/billing`)

```
 Plan and credits
 Pro, renews 14 Nov

 +-----------------------+  +-------------------+
 | 13 interviews left    |  | Manage plan       |
 | 7 of 20 used          |  | Change, cancel,   |
 | 2 rolled over         |  | invoices          |
 +-----------------------+  +-------------------+

 Recent activity
 Two Sum                     1 interview     Yesterday
 LRU Cache   connection lost  refunded       2 days ago
 Pack of 5                   +5              3 Oct
```

The activity list reads from the ledger and shows refunds openly. Cancel takes one click, with no retention maze.

### Pricing page (`/pricing`, public)

Reachable from the landing nav, between Debrief and Sign in. Three columns, with Pro raised by a surface step, not a badge or glow. Below them is a real debrief example, then short answers to what people actually ask: what counts as one interview, what happens if it fails, whether credits expire, how to cancel.

**Decision: don't ship this page yet.** A pricing page for something people can't buy reads as vapourware, and the numbers aren't validated. It ships in Phase 2. The landing page keeps "Free while in beta."

## User journey and improvement

| Stage | What they need | What exists | What to add |
| --- | --- | --- | --- |
| Discover | Understand it in ten seconds | Landing page with live beam and orb | Chrome Web Store listing |
| Set up | Reach a first question fast | Install steps, ready card, microphone help | A microphone check before the first question |
| First interview | A problem that fits them | Any open LeetCode problem | Suggest an Easy for the first one |
| First debrief | "That's accurate, and I can fix it" | Scores, summary, feedback | A single named focus at the top |
| Return | A reason for tomorrow | Up next, weekly goal | Target date, spaced redos |
| Improve | Proof it's working | Trends, skills, insights | The focus loop below |
| Pay | Value before the wall | Free interviews with full debriefs | Prompt appears only after a visible gain |

### The focus loop

This is the most important feature to build, and it's what a generic AI mock can't easily copy. Today, feedback ends at the debrief. Instead, each interview should build on the last.

```
  Debrief names one focus          "Narrate while you code"
           |
  Next interview knows it          The interviewer watches for it and
           |                       presses on it once, naturally
  Debrief answers it               "Last time you went quiet for 6 minutes.
           |                        Today your longest silence was 40 seconds."
  Focus clears, or stays, and the next one is chosen
```

It needs little new infrastructure: pass the focus into the interview prompt, then ask the debrief for a verdict on it. Silence length and time-to-first-working-code are measured from the timeline, not judged by the model, so the proof is real.

Three smaller features support it:

- **Spaced redos.** A problem scored below 6 comes back in Up next after 3 days, then 7. Overview already recognises repeat attempts, and "Two Sum went from 7 to 9" is the best message we can show.
- **Target date.** "My interview is on 12 December" sets the weekly goal and paces the plan. This also fixes the confusion around "goal hit": the goal of 3 stays the default, but the user can see where it came from and change it.
- **Pattern coverage.** A simple view of which interview patterns they've practised out loud, and which they're avoiding.

## Measures

| Question | Measure | Target to start |
| --- | --- | --- |
| Do people get going? | Finish a first interview within 24 hours of sign-up | 40% |
| Do they come back? | Do a second interview within 7 days | 35% |
| **Do they improve?** | Focus skill up at least 1 point within 5 interviews | 60% |
| Is it worth paying for? | Free to paid within 30 days | 4% |
| Is it viable? | Gross margin on Pro | 70% |
| Is it reliable? | Interviews that finish without a failure refund | 97% |

Improvement sits in the middle on purpose. If that number is weak, more marketing only spends money faster.

## Build order

**Phase 0: measure (2 to 3 days).** Add `session_usage`, record speech, voice and token counts, then run ten real interviews. Finalise prices from the results.

**Phase 1: credits with no payments (about a week).** Ledger, reserve and capture, time cap, free grants, a read-only billing page, the out-of-credits states in dashboard and extension. Every beta user stays free but runs on the real system, so the failure handling gets proven before money is involved.

**Phase 2: payments (about a week).** Checkout, webhooks, subscriptions, packs, the pricing page, cancel flow.

**Phase 3: the focus loop (1 to 2 weeks).** This can run alongside Phase 1, and it's worth starting before charging. People should feel the improvement before they're asked to pay for it.

**Phase 4: retention.** Target date, spaced redos, pattern coverage, weekly email.

### Before taking anyone's money

- Publish the extension and add the production origin to its manifest. The auth bridge only allows `http://localhost:5173/*` today.
- Add terms, a privacy policy and a refund policy. Interviews record people's voices and text, so state what's kept, for how long, and let users delete it.
- Add per-user rate limits on `POST /sessions` and the WebSocket.
- Test a full interview on live LeetCode with the real extension, including mic denial and a dropped connection.
- Add error reporting and a provider failover, so a model retirement can't take the product down.
