// Cross-platform key-value storage used for the Supabase session and a
// handful of small local flags (chosen role, anonymous quota, a pending
// valuation stash).
//
// Native (this file): expo-sqlite/kv-store, not
// @react-native-async-storage/async-storage -- Expo Go for SDK 58 no longer
// bundles that native module ("Native module is null, cannot access legacy
// storage"). expo-sqlite is a core Expo package (bundled in Expo Go either
// way) and its kv-store export is an explicit, documented drop-in
// replacement with the same getItem/setItem/removeItem shape.
//
// Web gets its own implementation (storage.web.ts, Metro picks it up
// automatically) instead of this file: expo-sqlite's web backend needs a
// wa-sqlite WASM asset that isn't actually present in this package version
// (node_modules/expo-sqlite/web/wa-sqlite/ doesn't exist), which breaks
// `expo export --platform web` entirely. A plain localStorage wrapper is
// simpler and was already effectively what the old AsyncStorage web
// implementation did.
import AsyncStorage from 'expo-sqlite/kv-store';

export default AsyncStorage;
