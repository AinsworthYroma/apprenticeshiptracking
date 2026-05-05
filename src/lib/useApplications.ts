import { useSyncExternalStore } from 'react';
import type { Application } from './types';
import { getApplications } from './storage';

/**
 * Internal set of listener callbacks that are notified whenever our
 * localStorage data changes within the same tab.  Cross-tab changes
 * are handled via the native "storage" event.
 */
const listeners = new Set<() => void>();

/**
 * Call this after every localStorage mutation so that all subscribed
 * components re-render immediately (useSyncExternalStore subscribers).
 */
export function notifyStorageChange(): void {
  listeners.forEach((fn) => fn());
}

function subscribe(callback: () => void): () => void {
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
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
