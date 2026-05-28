# Architecture

This document covers the **tech stack**, the **local vs. cloud data
boundary**, and the **folder structure** for Aria.

---

## 1. Tech Stack

### Mobile client — React Native + Expo (managed) + TypeScript

- **Why Expo:** fastest path to iOS + Android from one codebase, OTA updates
  for shipping safety fixes quickly, and first-class support for SQLite,
  SecureStore, and notifications without ejecting.
- **Expo Router** for file-based navigation, so the route tree mirrors the
  feature folders.
- **TypeScript everywhere** — the safety guardrails must be statically
  checkable.

### Local-first storage — Expo SQLite + Drizzle ORM (the privacy core)

- Sensitive data (**journal entries, chat transcripts, emotional check-ins,
  onboarding answers**) is stored **only on the device** in an
  **SQLCipher-encrypted** SQLite database. The encryption key lives in
  **Expo SecureStore** (Keychain / Keystore), never in the DB file or the cloud.
- **Drizzle ORM** gives typed, migration-friendly schemas over SQLite.
- Rationale: if the sensitive data never reaches our servers, it is not PHI
  *in our custody* and we stay out of HIPAA/BAA scope. This is the single most
  important architectural decision in the app.

### Cloud — Supabase (non-sensitive data ONLY)

Supabase is used **only** for data that is not sensitive and not identifying:

- **Anonymous auth** (a random device-scoped anon ID — no email, name, or
  phone required to use the app).
- **Resource catalog** (books, articles, exercises) — read-only reference data.
- **App config / feature flags / remote disclaimer copy.**
- **Opt-in, aggregate analytics** — counts and coarse events only, never
  message content, never journal text.

**Hard rule:** No table in Supabase may store free-text the user wrote about
their feelings, their partner, their messages, or their mental state. CI
includes a check (see `docs/COMPLIANCE.md`) and the cloud schema is
allow-list documented in `src/lib/storage/cloud/schema.ts`.

### AI — Anthropic Claude API via a stateless proxy

- The Attachment Coach is powered by **Claude** (default `claude-sonnet-4-6`
  for coaching turns; `claude-opus-4-8` available for heavier reflection).
- The API key **never ships in the app**. The client calls a **Supabase Edge
  Function** that forwards the request to Anthropic.
- The proxy is **stateless and content-blind**: it does not persist or log
  message bodies. It only enforces auth, rate limits, and the system prompt.
- The structured prompt template (`src/lib/ai/systemPrompt.ts`) prevents the
  model from producing diagnoses or medical advice — see
  [`SYSTEM_PROMPT.md`](SYSTEM_PROMPT.md).

### Supporting libraries

| Concern | Choice | Why |
| --- | --- | --- |
| Client state | **Zustand** | Tiny, no boilerplate, easy to test. |
| Schema validation | **Zod** | Validate AI I/O and onboarding answers. |
| Unit tests | **Jest** + ts-jest | Pure-logic guardrail tests run in CI without a device. |
| Lint/format | ESLint + Prettier | Consistency. |

### Why NOT a clinical/EHR stack

We intentionally avoid anything that would pull us into medical-device or
HIPAA territory: no covered-entity integrations, no claims submission, no
storing diagnoses, no provider portals. The therapist finder is **search
only** against public directories.

---

## 2. Local vs. Cloud Data Boundary

```
┌───────────────────────────── DEVICE (local-first) ─────────────────────────────┐
│  Encrypted SQLite (SQLCipher)         Key in SecureStore (Keychain/Keystore)    │
│  • journal_entries        ← sensitive free text, never leaves device            │
│  • chat_messages          ← coach transcripts, never leaves device              │
│  • emotional_checkins     ← mood/intensity logs                                 │
│  • onboarding_profile     ← primary struggle, personalization                   │
│  • session_activity       ← timestamps for wellness rate limiting               │
└─────────────────────────────────────────────────────────────────────────────────┘
                │  (only ephemeral request/response; nothing persisted server-side)
                ▼
┌──────────── EDGE FUNCTION (stateless, content-blind) ──────────┐
│  Forwards coach turns to Anthropic. No logging of message text. │
└─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────── CLOUD (Supabase) ─────────────────────────────────┐
│  • resources            ← public catalog (books/articles), read-only            │
│  • app_config           ← flags, disclaimer copy, hotline lists                 │
│  • anon_devices         ← random anon id only (no PII)                          │
│  • analytics_events     ← opt-in, aggregate, content-free                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

The code mirrors this split: `src/lib/storage/local/**` may only be imported
by feature code, and `src/lib/storage/cloud/**` may never import from
`local/**` (and vice-versa). This keeps sensitive data from accidentally
crossing the boundary.

---

## 3. Folder Structure

```
Aria/
├─ app/                         # Expo Router routes (thin screens → features)
│  ├─ _layout.tsx               # Root layout; mounts DisclaimerGate
│  ├─ index.tsx                 # Entry → onboarding or dashboard
│  ├─ onboarding/
│  ├─ (tabs)/
│  │  ├─ coach.tsx              # AI Attachment Coach
│  │  ├─ translate.tsx          # Men's Translation tool
│  │  ├─ resources.tsx          # Resource recommendations
│  │  └─ finder.tsx             # Therapist finder (search-only)
│  └─ crisis.tsx                # Crisis Mode screen (hotlines)
│
├─ src/
│  ├─ features/                 # Feature-scoped UI + hooks + state
│  │  ├─ onboarding/
│  │  ├─ coach/
│  │  ├─ translation/
│  │  ├─ resources/
│  │  └─ therapistFinder/
│  │
│  ├─ lib/                      # Cross-cutting, mostly pure logic
│  │  ├─ safety/                # ★ Guardrails (crisis detection, disclaimer)
│  │  │  ├─ crisisDetection.ts
│  │  │  ├─ disclaimer.ts
│  │  │  └─ index.ts
│  │  ├─ ai/                    # Prompt templates + coach/translation clients
│  │  │  ├─ systemPrompt.ts
│  │  │  ├─ translation.ts
│  │  │  ├─ coachClient.ts
│  │  │  └─ schema.ts           # Zod schemas for AI I/O
│  │  ├─ resources/             # Recommendation engine + catalog
│  │  │  ├─ recommendationEngine.ts
│  │  │  └─ catalog.ts
│  │  ├─ rateLimit/             # Wellness session limiting
│  │  │  └─ sessionLimiter.ts
│  │  └─ storage/
│  │     ├─ local/              # ★ Device-only, sensitive (SQLite/SQLCipher)
│  │     │  ├─ db.ts
│  │     │  ├─ schema.ts
│  │     │  └─ secureKey.ts
│  │     └─ cloud/              # Server, non-sensitive (Supabase)
│  │        ├─ client.ts
│  │        └─ schema.ts        # Allow-listed, content-free tables
│  │
│  ├─ constants/
│  │  └─ crisisResources.ts     # National hotlines (hard-coded fallback)
│  └─ types/
│
├─ supabase/
│  └─ functions/coach/          # Stateless Claude proxy (Edge Function)
│
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ SYSTEM_PROMPT.md
│  └─ COMPLIANCE.md
│
└─ __tests__/                   # Jest tests for the pure-logic guardrails
```

**Reading the tree:**
- `app/` is intentionally thin — screens delegate to `src/features/*`.
- `src/lib/safety` and `src/lib/storage/local` are the two folders to guard
  most carefully in review; they encode the non-negotiable invariants.
- The `local` vs `cloud` split under `src/lib/storage` is the physical
  embodiment of the data boundary diagram above.
