// Web counterpart to storage.ts (Metro resolves this automatically for the
// web platform). Plain localStorage, matching the async
// getItem/setItem/removeItem shape the rest of the app expects -- this is
// essentially what @react-native-async-storage/async-storage's own web
// implementation always did.
function getItem(key: string): Promise<string | null> {
  try {
    return Promise.resolve(window.localStorage.getItem(key));
  } catch {
    return Promise.resolve(null);
  }
}

function setItem(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore (e.g. private browsing / storage disabled) -- same
    // best-effort behavior as the native getItem's try/catch.
  }
  return Promise.resolve();
}

function removeItem(key: string): Promise<void> {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore, same as setItem above.
  }
  return Promise.resolve();
}

const storage = { getItem, setItem, removeItem };

export default storage;
