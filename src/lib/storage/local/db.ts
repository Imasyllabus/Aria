/**
 * Local encrypted SQLite database (device-only).
 *
 * Opens an SQLCipher-encrypted database whose key is held in SecureStore.
 * All sensitive data (journal, chat, check-ins) lives here and never leaves
 * the device.
 */
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import { getOrCreateDbKey } from './secureKey';
import * as schema from './schema';

const DB_NAME = 'aria.db';

let _db: ExpoSQLiteDatabase<typeof schema> | null = null;

/**
 * Open (once) and return the encrypted local database.
 */
export async function getLocalDb(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  if (_db) return _db;

  const key = await getOrCreateDbKey();
  const sqlite = await SQLite.openDatabaseAsync(DB_NAME);

  // Apply the SQLCipher key before any read/write. Must be the first statement.
  await sqlite.execAsync(`PRAGMA key = "x'${key}'";`);

  _db = drizzle(sqlite, { schema });
  return _db;
}

export { schema as localSchema };
