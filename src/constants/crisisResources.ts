/**
 * Hard-coded national emergency resources.
 *
 * These are bundled with the app so Crisis Mode works with NO network and NO
 * dependency on the AI or cloud. They are the last line of defense and must
 * never be removed. Remote config may *augment* this list (e.g. localized
 * lines) but must never replace these defaults.
 */

export interface CrisisResource {
  /** Display name of the service. */
  readonly name: string;
  /** What it's for, in plain language. */
  readonly description: string;
  /** Tel: number (digits only where possible) for tap-to-call. */
  readonly phone?: string;
  /** SMS short code / number for text-based help. */
  readonly sms?: string;
  /** Web URL for chat or more info. */
  readonly url?: string;
  /** ISO 3166-1 alpha-2 region this applies to. */
  readonly region: string;
}

/** United States defaults. */
export const US_CRISIS_RESOURCES: readonly CrisisResource[] = [
  {
    name: '988 Suicide & Crisis Lifeline',
    description: 'Free, confidential support 24/7 for people in distress.',
    phone: '988',
    sms: '988',
    url: 'https://988lifeline.org',
    region: 'US',
  },
  {
    name: 'Crisis Text Line',
    description: 'Text-based crisis support, 24/7. Text HOME to 741741.',
    sms: '741741',
    url: 'https://www.crisistextline.org',
    region: 'US',
  },
  {
    name: 'Emergency Services',
    description: 'If you are in immediate danger, call 911 right now.',
    phone: '911',
    region: 'US',
  },
] as const;

/**
 * Returns the crisis resources for a region, falling back to US defaults.
 * Always returns at least one resource.
 */
export function getCrisisResources(region: string = 'US'): readonly CrisisResource[] {
  switch (region.toUpperCase()) {
    case 'US':
    default:
      return US_CRISIS_RESOURCES;
  }
}
