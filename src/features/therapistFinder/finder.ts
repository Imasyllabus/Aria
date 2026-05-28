/**
 * Anonymous Therapist Finder — SEARCH ONLY.
 *
 * The user provides an insurance provider name and a location; we query PUBLIC
 * directories and show local clinics. NON-NEGOTIABLE: this shares NO user data
 * with any provider, schedules nothing, and stores nothing sensitive. The
 * search inputs are held in memory for the query only.
 */

export interface TherapistSearchQuery {
  /** Free-text insurance provider name, e.g. "Aetna". Used only to filter results. */
  insuranceProvider?: string;
  /** City / ZIP / region the user typed. */
  location: string;
}

export interface ClinicResult {
  readonly name: string;
  readonly address?: string;
  readonly phone?: string;
  readonly url?: string;
  /** Insurance networks the directory lists, if available. */
  readonly acceptedInsurance?: readonly string[];
  /** Which public directory this came from. */
  readonly source: string;
}

/** Adapter over a public directory (e.g. an open clinic-locator API). */
export interface DirectoryProvider {
  readonly name: string;
  search(query: TherapistSearchQuery): Promise<ClinicResult[]>;
}

/**
 * Run a search-only lookup across the configured public directories. Results
 * are de-duplicated and optionally filtered by the insurance the user typed.
 *
 * No user data is persisted or sent to providers — directories receive only
 * the location (and optional insurance string) needed to run the search.
 */
export async function findClinics(
  query: TherapistSearchQuery,
  providers: readonly DirectoryProvider[],
): Promise<ClinicResult[]> {
  if (!query.location?.trim()) return [];

  const settled = await Promise.allSettled(providers.map((p) => p.search(query)));
  const all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  const deduped = dedupeClinics(all);
  return filterByInsurance(deduped, query.insuranceProvider);
}

function dedupeClinics(clinics: readonly ClinicResult[]): ClinicResult[] {
  const seen = new Set<string>();
  const out: ClinicResult[] = [];
  for (const c of clinics) {
    const key = `${c.name.toLowerCase()}|${(c.address ?? '').toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

function filterByInsurance(
  clinics: readonly ClinicResult[],
  insurance?: string,
): ClinicResult[] {
  const needle = insurance?.trim().toLowerCase();
  if (!needle) return [...clinics];
  return clinics.filter((c) => {
    if (!c.acceptedInsurance || c.acceptedInsurance.length === 0) return true; // unknown → keep
    return c.acceptedInsurance.some((i) => i.toLowerCase().includes(needle));
  });
}
