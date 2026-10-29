// Sessions on the phone, locked by Android's keystore through expo-secure-store: the Edunex
// token and SIX's cookie never sit in a plain file. The desktop's twin is src/desktop/vault.ts.
import * as SecureStore from "expo-secure-store";
import type { Vault } from "../../../src/engine/store/storage";

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
// SecureStore keys allow letters, digits, ".", "-" and "_" only.
const keyOf = (name: string) => `edunexplus.${name.replace(/[^\w.-]/g, "_")}`;

export class PhoneVault implements Vault {
  /** Every name set since start-up, so "sign out of everything" can find them. */
  private readonly names = new Set<string>();

  get(name: string): Promise<string | null> {
    this.names.add(name);
    return SecureStore.getItemAsync(keyOf(name), OPTIONS);
  }

  async set(name: string, value: string): Promise<void> {
    this.names.add(name);
    await SecureStore.setItemAsync(keyOf(name), value, OPTIONS);
  }

  async delete(name: string): Promise<void> {
    await SecureStore.deleteItemAsync(keyOf(name), OPTIONS);
  }
}
