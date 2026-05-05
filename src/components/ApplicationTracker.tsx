'use client';

import type { Application, ApplicationStatus } from '@/lib/types';

interface ApplicationTrackerProps {
  offerId: string;
  application: Application | undefined;
  onStatusChange: (status: ApplicationStatus) => void;
  onRemove: () => void;
}

const STATUSES: { value: ApplicationStatus; label: string; color: string; bg: string }[] = [
  { value: 'interested', label: 'Intéressé(e)', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { value: 'applied', label: 'Candidature envoyée', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
  { value: 'interview', label: 'Entretien obtenu', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { value: 'offer', label: 'Offre reçue 🎉', color: 'text-green-700', bg: 'bg-green-50 border-green-200 hover:bg-green-100' },
  { value: 'rejected', label: 'Refus', color: 'text-red-700', bg: 'bg-red-50 border-red-200 hover:bg-red-100' },
];

export default function ApplicationTracker({
  application,
  onStatusChange,
  onRemove,
}: ApplicationTrackerProps) {
  const currentStatus = application?.status;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          Suivi de candidature
        </h2>
        {application?.appliedDate && (
          <p className="text-xs text-gray-400 mt-0.5">
            Candidature envoyée le{' '}
            {new Date(application.appliedDate).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      <div className="p-5 space-y-2">
        {STATUSES.map((s) => {
          const active = currentStatus === s.value;
          return (
            <button
              key={s.value}
              onClick={() => onStatusChange(s.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                active
                  ? `${s.bg} ${s.color} border-2`
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{s.label}</span>
              {active && (
                <svg
                  className={`w-4 h-4 ${s.color}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {application && (
        <div className="px-5 pb-4">
          <button
            onClick={onRemove}
            className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
          >
            Supprimer le suivi
          </button>
        </div>
      )}
    </div>
  );
}
