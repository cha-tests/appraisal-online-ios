import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which path a signed-out visitor picked on the Choose role screen
 * (app/welcome.tsx), persisted per-device so a relaunch before they ever
 * create an account doesn't ask again — see the design brief's "Persist the
 * choice... so it survives a reinstall-free relaunch". Not the same thing as
 * the account's own user_type: once a real account/session exists, THAT
 * value drives routing (see index.tsx) and this is no longer consulted.
 */
const KEY = 'chosen_role';
export type ChosenRole = 'consumer' | 'broker';

export async function getChosenRole(): Promise<ChosenRole | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === 'consumer' || raw === 'broker' ? raw : null;
}

export async function setChosenRole(role: ChosenRole): Promise<void> {
  await AsyncStorage.setItem(KEY, role);
}
