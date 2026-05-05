import { useSyncExternalStore } from 'react';
import type { Application } from './types';
import { getApplications } from './storage';
import { subscribeToStorageChanges } from './storageEvents';

// Re-export for external callers that need to trigger notifications
export { notifyStorageChange } from './storageEvents';

function getSnapshot(): Application[] {
  return getApplications();
}

function getServerSnapshot(): Application[] {
  return [];
}

/**
 * Reactive hook — returns the current list of tracked applications
 * and automatically re-renders whenever it changes.
 */
export function useApplications(): Application[] {
  return useSyncExternalStore(subscribeToStorageChanges, getSnapshot, getServerSnapshot);
}
