/**
 * CLOUD (Supabase) schema — ALLOW-LIST of NON-SENSITIVE tables only.
 *
 * ★ HARD RULE: no table here may store free text the user wrote about their
 * feelings, partner, messages, or mental state. Anything sensitive belongs in
 * the LOCAL encrypted DB. Adding a column here requires a compliance review
 * (see docs/COMPLIANCE.md). These are TypeScript shapes documenting the
 * server contract; the actual tables are defined in Supabase migrations.
 */

/** Anonymous device record — random id only, no PII. */
export interface AnonDeviceRow {
  /** Random anon id (e.g. uuid). Not linked to any real identity. */
  anon_id: string;
  /** ISO region for localized hotline lists. */
  region: string | null;
  created_at: string;
}

/** Public resource catalog (books/articles/exercises). Read-only reference. */
export interface ResourceRow {
  id: string;
  title: string;
  author: string | null;
  type: 'book' | 'article' | 'exercise';
  blurb: string;
  tags: string[];
}

/** Remote app config / feature flags / disclaimer copy. */
export interface AppConfigRow {
  key: string;
  value: string;
}

/**
 * Opt-in, AGGREGATE analytics. Event names + counts only — NEVER message
 * content, NEVER journal text, NEVER anything the user typed about themselves.
 */
export interface AnalyticsEventRow {
  anon_id: string;
  /** Coarse event name, e.g. "coach_turn", "resource_opened". */
  event: string;
  /** Optional non-sensitive numeric value (e.g. duration bucket index). */
  value: number | null;
  created_at: string;
}

/**
 * Compile-time guard: the set of cloud tables. Keep this list in sync with the
 * compliance doc. (A CI script can assert no other tables exist in migrations.)
 */
export const CLOUD_TABLE_ALLOWLIST = [
  'anon_devices',
  'resources',
  'app_config',
  'analytics_events',
] as const;

export type CloudTable = (typeof CLOUD_TABLE_ALLOWLIST)[number];
