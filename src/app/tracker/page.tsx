'use client';

import Link from 'next/link';
import { OFFERS } from '@/lib/data';
import { updateApplicationStatus, removeApplication } from '@/lib/storage';
import { useApplications } from '@/lib/useApplications';
import type { ApplicationStatus } from '@/lib/types';

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  interested: { label: 'Intéressé(e)', color: 'text-blue-700', bg: 'bg-blue-50', icon: '👀' },
  applied: { label: 'Candidature envoyée', color: 'text-indigo-700', bg: 'bg-indigo-50', icon: '📨' },
  interview: { label: 'Entretien', color: 'text-amber-700', bg: 'bg-amber-50', icon: '🤝' },
  offer: { label: 'Offre reçue', color: 'text-green-700', bg: 'bg-green-50', icon: '🎉' },
  rejected: { label: 'Refus', color: 'text-red-700', bg: 'bg-red-50', icon: '❌' },
};

const STATUSES = Object.keys(STATUS_CONFIG) as ApplicationStatus[];

export default function TrackerPage() {
  const applications = useApplications();

  if (applications.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Aucune candidature suivie</h1>
        <p className="text-gray-500 mb-8">
          Parcourez les offres et marquez-les comme &laquo;&nbsp;Intéressé(e)&nbsp;&raquo; ou &laquo;&nbsp;Candidature envoyée&nbsp;&raquo; pour les retrouver ici.
        </p>
        <Link href="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
          Voir les offres
        </Link>
      </div>
    );
  }

  const grouped = STATUSES.reduce<Record<ApplicationStatus, typeof applications>>(
    (acc, s) => {
      acc[s] = applications.filter((a) => a.status === s);
      return acc;
    },
    {} as Record<ApplicationStatus, typeof applications>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mes candidatures</h1>
        <p className="mt-2 text-gray-500">
          {applications.length} candidature{applications.length > 1 ? 's' : ''} suivie{applications.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {STATUSES.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const count = grouped[status].length;
          return (
            <div key={status} className={`${cfg.bg} rounded-xl p-4 text-center`}>
              <div className="text-2xl mb-1">{cfg.icon}</div>
              <div className={`text-2xl font-bold ${cfg.color}`}>{count}</div>
              <div className={`text-xs font-medium ${cfg.color} opacity-80 mt-0.5`}>{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {STATUSES.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const apps = grouped[status];
          return (
            <div key={status} className="flex flex-col">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg} mb-3`}>
                <span>{cfg.icon}</span>
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className={`ml-auto text-xs font-medium ${cfg.color} opacity-70`}>{apps.length}</span>
              </div>

              <div className="space-y-2">
                {apps.map((app) => {
                  const offer = OFFERS.find((o) => o.id === app.offerId);
                  if (!offer) return null;
                  const initials = offer.company.split(' ').slice(0, 2).map((w) => w[0]).join('');
                  return (
                    <div key={app.offerId} className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/offers/${offer.id}`}
                            className="text-xs font-semibold text-gray-900 hover:text-indigo-600 transition-colors line-clamp-2 leading-snug"
                          >
                            {offer.title}
                          </Link>
                          <p className="text-xs text-gray-400 mt-0.5">{offer.company}</p>
                        </div>
                      </div>

                      {app.appliedDate && (
                        <p className="text-xs text-gray-400 mb-2">
                          Envoyée le {new Date(app.appliedDate).toLocaleDateString('fr-FR')}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        {STATUSES.filter((s) => s !== status).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateApplicationStatus(offer.id, s)}
                            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                            title={`Marquer comme: ${STATUS_CONFIG[s].label}`}
                          >
                            {STATUS_CONFIG[s].icon}
                          </button>
                        ))}
                        <button
                          onClick={() => removeApplication(offer.id)}
                          className="text-xs text-gray-300 hover:text-red-400 transition-colors ml-auto"
                          title="Supprimer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
