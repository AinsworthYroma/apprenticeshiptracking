'use client';

import Link from 'next/link';
import type { ApprenticeshipOffer } from '@/lib/types';
import type { Application } from '@/lib/types';

interface OfferCardProps {
  offer: ApprenticeshipOffer;
  application?: Application;
}

const COMPANY_TYPE_COLORS: Record<string, string> = {
  startup: 'bg-violet-100 text-violet-700',
  pme: 'bg-blue-100 text-blue-700',
  'grand-groupe': 'bg-indigo-100 text-indigo-700',
  public: 'bg-teal-100 text-teal-700',
  cabinet: 'bg-amber-100 text-amber-700',
};

const COMPANY_TYPE_LABELS: Record<string, string> = {
  startup: 'Startup',
  pme: 'PME',
  'grand-groupe': 'Grand groupe',
  public: 'Secteur public',
  cabinet: 'Cabinet',
};

const STATUS_COLORS: Record<string, string> = {
  interested: 'bg-blue-100 text-blue-700',
  applied: 'bg-indigo-100 text-indigo-700',
  interview: 'bg-amber-100 text-amber-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  interested: '👀 Intéressé(e)',
  applied: '📨 Candidature envoyée',
  interview: '🤝 Entretien',
  offer: '🎉 Offre reçue',
  rejected: '❌ Refus',
};

function CredibilityStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`Crédibilité : ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i <= value ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function OfferCard({ offer, application }: OfferCardProps) {
  const initials = offer.company
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  return (
    <Link href={`/offers/${offer.id}`} className="block group">
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200">
        <div className="flex items-start gap-4">
          {/* Company Avatar */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {initials}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug">
                  {offer.title}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{offer.company}</p>
              </div>
              <CredibilityStars value={offer.credibility} />
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  COMPANY_TYPE_COLORS[offer.companyType]
                }`}
              >
                {COMPANY_TYPE_LABELS[offer.companyType]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                📍 {offer.location}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                🕐 {offer.duration}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                💶 {offer.salary.toLocaleString('fr-FR')} €/mois
              </span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              {offer.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Application status */}
            {application && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    STATUS_COLORS[application.status]
                  }`}
                >
                  {STATUS_LABELS[application.status]}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
