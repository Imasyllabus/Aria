# Aria — Men's Mental Health & Emotional Intelligence

Aria is a **wellness and coaching** mobile app that helps men navigate
**anxious attachment**, build emotional literacy, and improve relationship
dynamics. It pairs a grounded AI mentor with privacy-first journaling, a
"Men's Translation" message tool, a resource recommendation engine, and an
anonymous therapist finder.

> ⚠️ **Aria is not therapy, counseling, or medical care.** It is an
> educational coaching tool. See [Guardrails](#non-negotiable-guardrails).

---

## Non-Negotiable Guardrails

These are product invariants, not features. They must never be silently
removed or downgraded.

1. **Not a medical device.** Aria is a wellness/coaching app. We deliberately
   avoid storing Protected Health Information (PHI) so that **HIPAA and BAA
   obligations do not apply**. See [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).
2. **No PHI on our servers.** Sensitive content (journal entries, chat
   history, emotional reflections) is **local-first** and stays on the user's
   device. The cloud stores only non-sensitive, non-identifying data.
3. **Disclaimer-first.** Every session is governed by a "this is not therapy"
   disclaimer that the user must acknowledge before coaching begins.
4. **Crisis Mode.** A hard-coded detector scans user input for self-harm /
   crisis signals. On a match it **disables the AI response for that input**
   and immediately surfaces national emergency hotlines. This logic is local,
   deterministic, and runs *before* any network call. See
   [`src/lib/safety`](src/lib/safety).
5. **Non-clinical AI.** The Attachment Coach uses a structured system prompt
   that forbids diagnosis, medication advice, and clinical claims. See
   [`docs/SYSTEM_PROMPT.md`](docs/SYSTEM_PROMPT.md).
6. **Search-only therapist finder.** The therapist finder queries public
   directories and shares **no user data** with any provider.
7. **Wellness rate limiting.** If a user has been processing intensely for a
   long stretch, Aria gently suggests a break. See
   [`src/lib/rateLimit`](src/lib/rateLimit).

---

## Core Features

| Feature | What it does | Where |
| --- | --- | --- |
| **AI Attachment Coach** | Grounded, supportive mentor grounded in Attachment Theory + CBT journaling. | `src/features/coach`, `src/lib/ai` |
| **Men's Translation** | Drafts a message → suggests a "secure attachment" revision. | `src/lib/ai/translation.ts` |
| **Resource Engine** | Recommends books/resources from chat context (e.g. *Attached*, *No More Mr. Nice Guy*). | `src/lib/resources` |
| **Therapist Finder** | Search-only lookup by insurance + location against public directories. | `src/features/therapistFinder` |
| **Onboarding** | Identifies the user's primary struggle to personalize the dashboard. | `src/features/onboarding` |

---

## Tech Stack (summary)

- **Mobile:** React Native + **Expo** (managed) + TypeScript + Expo Router
- **Local-first storage:** Expo SQLite (SQLCipher-encrypted) + Drizzle ORM — for journal & chat (never leaves device)
- **Cloud (non-sensitive only):** Supabase — anonymous auth, app config, resource catalog, opt-in aggregate analytics
- **AI:** Anthropic Claude API behind a stateless Supabase Edge Function proxy (keys never on device, message bodies never logged)
- **State:** Zustand · **Validation:** Zod · **Tests:** Jest

Full rationale and the local/cloud data boundary are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Getting Started

```bash
npm install
npm run start      # Expo dev server
npm test           # run the safety + logic unit tests
npm run typecheck  # tsc --noEmit
```

> The safety-critical modules (`src/lib/safety`, `src/lib/rateLimit`,
> `src/lib/resources`) are pure TypeScript and fully unit-tested so they can
> be validated without a device or simulator.

## Repository layout

See [`docs/ARCHITECTURE.md#folder-structure`](docs/ARCHITECTURE.md#folder-structure)
for the full tree and the rationale behind separating **local** (device-only,
sensitive) from **cloud** (server, non-sensitive) data.
