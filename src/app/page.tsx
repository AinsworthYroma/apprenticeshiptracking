'use client';

import { useState, useMemo } from 'react';
import { OFFERS } from '@/lib/data';
import { useApplications } from '@/lib/useApplications';
import type { CompanyType, JobFamily } from '@/lib/types';
import OfferCard from '@/components/OfferCard';
import FilterBar from '@/components/FilterBar';

export default function HomePage() {
  const applications = useApplications();
  const [search, setSearch] = useState('');
  const [companyTypeFilter, setCompanyTypeFilter] = useState<CompanyType | 'all'>('all');
  const [jobFamilyFilter, setJobFamilyFilter] = useState<JobFamily | 'all'>('all');
  const [credibilityFilter, setCredibilityFilter] = useState(0);
  const [durationFilter, setDurationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  const resetFilters = () => {
    setSearch('');
    setCompanyTypeFilter('all');
    setJobFamilyFilter('all');
    setCredibilityFilter(0);
    setDurationFilter('all');
  };

  const filtered = useMemo(() => {
    let list = OFFERS.filter((offer) => {
      if (
        search &&
        !offer.title.toLowerCase().includes(search.toLowerCase()) &&
        !offer.company.toLowerCase().includes(search.toLowerCase()) &&
        !offer.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      ) {
        return false;
      }
      if (companyTypeFilter !== 'all' && offer.companyType !== companyTypeFilter) return false;
      if (jobFamilyFilter !== 'all' && offer.jobFamily !== jobFamilyFilter) return false;
      if (credibilityFilter > 0 && offer.credibility < credibilityFilter) return false;
      if (durationFilter !== 'all' && offer.duration !== durationFilter) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'credibility':
          return b.credibility - a.credibility;
        case 'salary':
          return b.salary - a.salary;
        case 'company':
          return a.company.localeCompare(b.company, 'fr');
        default:
          return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
      }
    });

    return list;
  }, [search, companyTypeFilter, jobFamilyFilter, credibilityFilter, durationFilter, sortBy]);

  const appMap = useMemo(() => {
    const m: Record<string, (typeof applications)[number]> = {};
    applications.forEach((a) => (m[a.offerId] = a));
    return m;
  }, [applications]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Offres d&apos;alternance à{' '}
          <span className="text-indigo-600">Paris</span>
        </h1>
        <p className="mt-2 text-gray-500">
          {OFFERS.length} offres disponibles · Triées et filtrées pour vous
        </p>
      </div>

      <div className="relative mb-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 pl-4 flex items-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un poste, une entreprise, un mot-clé…"
          className="w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex gap-6 items-start">
        <FilterBar
          companyTypeFilter={companyTypeFilter}
          jobFamilyFilter={jobFamilyFilter}
          credibilityFilter={credibilityFilter}
          durationFilter={durationFilter}
          sortBy={sortBy}
          onCompanyTypeChange={setCompanyTypeFilter}
          onJobFamilyChange={setJobFamilyFilter}
          onCredibilityChange={setCredibilityFilter}
          onDurationChange={setDurationFilter}
          onSortChange={setSortBy}
          totalResults={filtered.length}
        />

        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400 font-medium">Aucune offre ne correspond à vos critères</p>
              <button
                onClick={resetFilters}
                className="mt-4 text-indigo-600 text-sm hover:underline"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((offer) => (
                <OfferCard key={offer.id} offer={offer} application={appMap[offer.id]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
