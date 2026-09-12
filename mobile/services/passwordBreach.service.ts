import * as Crypto from 'expo-crypto';

/**
 * Checks a password against Have I Been Pwned's Pwned Passwords database,
 * using the k-anonymity range API so the actual password (or its full hash)
 * never leaves the device — only the first 5 hex characters of its SHA-1
 * hash are sent, and the match against the remaining characters happens
 * locally against the list HIBP returns for that prefix.
 *
 * See https://haveibeenpwned.com/API/v3#PwnedPasswords.
 */
export interface PasswordBreachResult {
  breached: boolean;
  /** Number of times this exact password has appeared in known breaches. */
  timesSeen?: number;
}

export async function checkPasswordBreach(password: string): Promise<PasswordBreachResult> {
  try {
    const hash = (
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, password)
    ).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) {
      // Fail open — a broken breach-check service shouldn't block signup.
      return { breached: false };
    }

    const body = await response.text();
    const match = body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith(suffix));

    if (!match) {
      return { breached: false };
    }

    const timesSeen = parseInt(match.split(':')[1] ?? '0', 10);
    return { breached: true, timesSeen: Number.isNaN(timesSeen) ? undefined : timesSeen };
  } catch (err) {
    console.error('Error checking password breach:', err);
    // Fail open — a network error shouldn't block signup.
    return { breached: false };
  }
}
