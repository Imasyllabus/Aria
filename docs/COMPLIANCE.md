# Compliance & Safety Posture

Aria is deliberately scoped as a **wellness / coaching** product, not a
clinical or medical device. This document records the decisions that keep it
out of HIPAA/BAA scope and the safety mechanisms that protect users.

## Why we are not a HIPAA covered entity / business associate

- We are **not** a healthcare provider, health plan, or clearinghouse, and we
  do not perform covered transactions on anyone's behalf.
- We do not store **Protected Health Information (PHI)** in our custody.
  Sensitive content is **local-first** and encrypted on the user's device.
- We do not produce diagnoses, treatment, or medical records.
- The therapist finder is **search-only** against public directories; we do not
  transmit user data to providers or schedule care.

> This is a product/architecture posture, not legal advice. Have counsel review
> before launch and before any change that would put user health content on our
> servers.

## The PHI firewall (engineering rules)

1. Free-text the user writes about feelings, partners, messages, or mental
   state is written **only** to the local encrypted DB
   (`src/lib/storage/local`). It must never be inserted into a Supabase table.
2. The AI proxy (`supabase/functions/coach`) is **stateless and content-blind**:
   it must not log or persist message bodies.
3. The cloud schema (`src/lib/storage/cloud/schema.ts`) is an **allow-list** of
   content-free tables. Adding a free-text user-content column requires explicit
   review and an update to this doc.
4. Analytics are **opt-in** and **aggregate/event-only** — counts and coarse
   event names, never message text.

## Disclaimer-first

The user must acknowledge the "Aria is not therapy" disclaimer before any
coaching session. Copy and acknowledgement state are handled by
`src/lib/safety/disclaimer.ts`. Heavy exchanges also close with a soft
reminder (see the system prompt).

## Crisis Mode (hard-coded)

- `src/lib/safety/crisisDetection.ts` runs a **deterministic, local** scan of
  every user input *before* any network/AI call.
- On a match, the app **suppresses the AI response for that input** and routes
  to the Crisis screen showing national hotlines from
  `src/constants/crisisResources.ts`.
- Detection is intentionally **high-recall** (better to over-trigger and show
  help than to miss). It does not depend on the network or the model.
- The model is *also* instructed to defer to crisis handling as a backup.

## Wellness rate limiting

`src/lib/rateLimit/sessionLimiter.ts` tracks session intensity locally. After a
sustained stretch it surfaces a gentle break suggestion
("It looks like you've been processing a lot today — why not take a 10-minute
walk and come back?"). This protects the user's wellbeing and bounds API cost.
Crisis handling is **never** rate-limited.
