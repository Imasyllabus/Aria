/**
 * Manages the SQLCipher encryption key for the local database.
 *
 * The key lives in the OS keystore via Expo SecureStore (Keychain on iOS,
 * Keystore on Android). It is generated once on first launch and never leaves
 * the device, never written to the DB file, and never synced to the cloud.
 */
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'aria.local.db.key';

/** Generate a 256-bit hex key. */
function generateKey(): string {
  const bytes = new Uint8Array(32);
  // Expo provides global crypto.getRandomValues in the RN runtime.
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Return the local DB encryption key, creating and persisting it on first run.
 */
export async function getOrCreateDbKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return existing;

  const key = generateKey();
  await SecureStore.setItemAsync(KEY_NAME, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}
