'use client';

import type { CompanyType, JobFamily } from '@/lib/types';

interface FilterBarProps {
  companyTypeFilter: CompanyType | 'all';
  jobFamilyFilter: JobFamily | 'all';
  credibilityFilter: number;
  durationFilter: string;
  sortBy: string;
  onCompanyTypeChange: (v: CompanyType | 'all') => void;
  onJobFamilyChange: (v: JobFamily | 'all') => void;
  onCredibilityChange: (v: number) => void;
  onDurationChange: (v: string) => void;
  onSortChange: (v: string) => void;
  totalResults: number;
}

const COMPANY_TYPE_LABELS: Record<CompanyType | 'all', string> = {
  all: 'Tous types',
  startup: '🚀 Startup / Scale-up',
  pme: '🏢 PME',
  'grand-groupe': '🏦 Grand groupe',
  public: '🏛️ Secteur public',
  cabinet: '💼 Cabinet de conseil',
};

const JOB_FAMILY_LABELS: Record<JobFamily | 'all', string> = {
  all: 'Tous métiers',
  marketing: '📣 Marketing',
  finance: '💰 Finance',
  rh: '👥 Ressources Humaines',
  commerce: '🛒 Commerce / Vente',
  tech: '💻 Tech / Digital',
  communication: '📢 Communication',
  logistique: '📦 Logistique',
  juridique: '⚖️ Juridique',
  conseil: '🔍 Conseil',
};

const SORT_OPTIONS = [
  { value: 'date', label: 'Plus récentes' },
  { value: 'credibility', label: 'Crédibilité (desc.)' },
  { value: 'salary', label: 'Salaire (desc.)' },
  { value: 'company', label: 'Entreprise (A-Z)' },
];

export default function FilterBar({
  companyTypeFilter,
  jobFamilyFilter,
  credibilityFilter,
  durationFilter,
  sortBy,
  onCompanyTypeChange,
  onJobFamilyChange,
  onCredibilityChange,
  onDurationChange,
  onSortChange,
  totalResults,
}: FilterBarProps) {
  return (
    <aside className="w-full lg:w-72 shrink-0">
      <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Filtres</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {totalResults} offre{totalResults > 1 ? 's' : ''}
          </span>
        </div>

        {/* Sort */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Trier par
          </label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Company Type */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Type d&apos;entreprise
          </label>
          <div className="space-y-1">
            {(Object.keys(COMPANY_TYPE_LABELS) as (CompanyType | 'all')[]).map((key) => (
              <button
                key={key}
                onClick={() => onCompanyTypeChange(key)}
                className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  companyTypeFilter === key
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {COMPANY_TYPE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Job Family */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Famille de métiers
          </label>
          <div className="space-y-1">
            {(Object.keys(JOB_FAMILY_LABELS) as (JobFamily | 'all')[]).map((key) => (
              <button
                key={key}
                onClick={() => onJobFamilyChange(key)}
                className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  jobFamilyFilter === key
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {JOB_FAMILY_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Credibility */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Crédibilité minimale
          </label>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => onCredibilityChange(n)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  credibilityFilter === n
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {n === 0 ? 'Tous' : `${n}★`}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Durée
          </label>
          <div className="space-y-1">
            {['all', '12 mois', '24 mois', '6 mois'].map((d) => (
              <button
                key={d}
                onClick={() => onDurationChange(d)}
                className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  durationFilter === d
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {d === 'all' ? 'Toutes durées' : d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
