export class LoadTimeoutError extends Error {
  constructor(message = 'This is taking longer than expected.') {
    super(message);
    this.name = 'LoadTimeoutError';
  }
}

/**
 * Races a promise against a timeout so a slow or hung backend call surfaces
 * as a normal catchable error instead of leaving a screen on its loading
 * spinner forever — several data-dependent screens had no such ceiling
 * (confirmed: Broker Dashboard, Lead Inbox, Broker Settings, Consumer
 * Settings, Consumer Account, the public Coverage page).
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LoadTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
