/**
 * LOCAL (device-only) database schema — Drizzle ORM over Expo SQLite.
 *
 * ★ Everything here is SENSITIVE and stays on the device. It is encrypted at
 * rest (SQLCipher) and is NEVER synced to the cloud. Do not add a sync layer
 * to these tables without a compliance review (see docs/COMPLIANCE.md).
 */
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Onboarding answers + personalization. */
export const onboardingProfile = sqliteTable('onboarding_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Non-clinical tag, e.g. "anxious-when-no-reply". */
  primaryStruggleTag: text('primary_struggle_tag'),
  /** Free text the user gave describing their struggle (sensitive). */
  primaryStruggleText: text('primary_struggle_text'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

/** Coach chat transcripts (sensitive free text). */
export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

/** Journal entries (sensitive free text). */
export const journalEntries = sqliteTable('journal_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title'),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

/** Mood / intensity check-ins. */
export const emotionalCheckins = sqliteTable('emotional_checkins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 1-5 intensity. */
  intensity: integer('intensity').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

/** Coaching-turn timestamps used by the wellness rate limiter. */
export const sessionActivity = sqliteTable('session_activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  turnAt: integer('turn_at').notNull().default(sql`(unixepoch())`),
});
