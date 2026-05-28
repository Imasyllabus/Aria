/**
 * Stateless, content-blind Coach proxy (Supabase Edge Function / Deno).
 *
 * Responsibilities:
 *   - Hold the Anthropic API key (never shipped to the client).
 *   - Inject the system prompt server-side so it can't be tampered with.
 *   - Forward the turn to Claude and return the raw text.
 *
 * NON-NEGOTIABLE: this function MUST NOT log or persist message bodies. It is
 * intentionally stateless. (Crisis detection still runs client-side BEFORE
 * this is ever called; the system prompt also instructs the model to defer.)
 *
 * Note: this file targets the Deno edge runtime, not the RN bundle. The
 * `npm:`/`Deno` references are resolved at deploy time by Supabase.
 */
// @ts-nocheck — Deno edge runtime; types provided by the Supabase deploy env.
import Anthropic from 'npm:@anthropic-ai/sdk';

// The system prompt is duplicated here intentionally: the client bundle and
// the edge function are separate deploy targets. Keep in sync with
// src/lib/ai/systemPrompt.ts (and docs/SYSTEM_PROMPT.md).
const COACH_SYSTEM_PROMPT = Deno.env.get('COACH_SYSTEM_PROMPT') ?? '';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { message, history = [], primaryStruggleTag } = await req.json();

    const personalization = primaryStruggleTag
      ? `\n\nCONTEXT: The user's self-identified focus area is "${primaryStruggleTag}". Keep this in mind, but let him lead.`
      : '';

    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: COACH_SYSTEM_PROMPT + personalization,
      messages,
    });

    const text = completion.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('');

    // Return only the model text. Nothing is logged or stored.
    return new Response(JSON.stringify({ text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Do not echo the error body (it could contain message content).
    return new Response(JSON.stringify({ error: 'coach_unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
