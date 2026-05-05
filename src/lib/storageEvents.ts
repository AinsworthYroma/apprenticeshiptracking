/**
 * Lightweight event bus for localStorage change notifications.
 * Shared between storage.ts (writers) and useApplications.ts (readers)
 * to avoid a circular module dependency.
 */
const listeners = new Set<() => void>();

/**
 * Subscribe to storage change events.  Returns an unsubscribe function.
 */
export function subscribeToStorageChanges(callback: () => void): () => void {
  listeners.add(callback);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', callback);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', callback);
    }
  };
}

/**
 * Notify all subscribers that localStorage data has changed.
 * Call this synchronously after every localStorage mutation.
 */
export function notifyStorageChange(): void {
  listeners.forEach((fn) => fn());
}
