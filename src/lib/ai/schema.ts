/**
 * Zod schemas for AI input/output. These guard against the model returning
 * malformed or unsafe payloads, and give us typed access to coach responses.
 */
import { z } from 'zod';

export const CoachResponseSchema = z.object({
  reply: z.string().min(1),
  detectedAttachmentSignals: z.array(z.string()).optional(),
  suggestedResourceTags: z.array(z.string()).optional(),
  deferToCrisis: z.boolean().optional().default(false),
});

export type CoachResponse = z.infer<typeof CoachResponseSchema>;

export const TranslationResponseSchema = z.object({
  /** The rewritten, secure-attachment version of the message. */
  rewrite: z.string().min(1),
  /** One-line note on what shifted and why. */
  note: z.string().min(1),
});

export type TranslationResponse = z.infer<typeof TranslationResponseSchema>;

/**
 * Safely parse a model response string into a CoachResponse, tolerating
 * code-fences and surrounding prose the model may add.
 */
export function parseCoachResponse(raw: string): CoachResponse {
  const json = extractJson(raw);
  return CoachResponseSchema.parse(json);
}

export function parseTranslationResponse(raw: string): TranslationResponse {
  const json = extractJson(raw);
  return TranslationResponseSchema.parse(json);
}

/** Extract the first JSON object from a possibly fenced/prose-wrapped string. */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
