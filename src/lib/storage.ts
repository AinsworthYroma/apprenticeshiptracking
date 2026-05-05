'use client';

import type { Application, ApplicationStatus, UserProfile } from './types';

const APPLICATIONS_KEY = 'apprenticeship_applications';
const PROFILE_KEY = 'apprenticeship_profile';

// Lazy import to avoid circular dependency — resolved at call time
function notify(): void {
  // Dynamic import pattern avoids the circular dep at module level
  import('./useApplications').then(({ notifyStorageChange }) =>
    notifyStorageChange()
  );
}

export function getApplications(): Application[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(APPLICATIONS_KEY);
    return raw ? (JSON.parse(raw) as Application[]) : [];
  } catch {
    return [];
  }
}

export function getApplication(offerId: string): Application | undefined {
  return getApplications().find((a) => a.offerId === offerId);
}

export function saveApplication(application: Application): void {
  const applications = getApplications();
  const existing = applications.findIndex((a) => a.offerId === application.offerId);
  if (existing >= 0) {
    applications[existing] = application;
  } else {
    applications.push(application);
  }
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
  notify();
}

export function removeApplication(offerId: string): void {
  const applications = getApplications().filter((a) => a.offerId !== offerId);
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
  notify();
}

export function updateApplicationStatus(offerId: string, status: ApplicationStatus): void {
  const app = getApplication(offerId);
  const updatedAt = new Date().toISOString();
  if (app) {
    saveApplication({
      ...app,
      status,
      updatedAt,
      appliedDate:
        status === 'applied' && !app.appliedDate
          ? new Date().toISOString().split('T')[0]
          : app.appliedDate,
    });
  } else {
    saveApplication({
      offerId,
      status,
      updatedAt,
      appliedDate:
        status === 'applied' ? new Date().toISOString().split('T')[0] : undefined,
    });
  }
}

export function getProfile(): UserProfile {
  if (typeof window === 'undefined') {
    return defaultProfile();
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function defaultProfile(): UserProfile {
  return {
    firstName: 'Prénom',
    lastName: 'Nom',
    school: 'Rennes School of Business',
    program: 'MSc Marketing & Commerce',
    graduationYear: 2026,
    email: 'prenom.nom@rennes-sb.com',
    phone: '',
    linkedinUrl: '',
    skills: ['Analyse de données', 'Marketing digital', 'Communication'],
  };
}
