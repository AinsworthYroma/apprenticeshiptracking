'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { OFFERS, ALUMNI, COMPANY_NEWS } from '@/lib/data';
import { generateCoverLetter } from '@/lib/coverLetter';
import {
  updateApplicationStatus,
  removeApplication,
  getProfile,
} from '@/lib/storage';
import { useApplications } from '@/lib/useApplications';
import type { ApplicationStatus } from '@/lib/types';
import CoverLetter from '@/components/CoverLetter';
import CompanyNewsSection from '@/components/CompanyNewsSection';
import AlumniList from '@/components/AlumniList';
import ApplicationTracker from '@/components/ApplicationTracker';

const COMPANY_TYPE_LABELS: Record<string, string> = {
  startup: 'Startup',
  pme: 'PME',
  'grand-groupe': 'Grand groupe',
  public: 'Secteur public',
  cabinet: 'Cabinet de conseil',
};

const COMPANY_TYPE_COLORS: Record<string, string> = {
  startup: 'bg-violet-100 text-violet-700',
  pme: 'bg-blue-100 text-blue-700',
  'grand-groupe': 'bg-indigo-100 text-indigo-700',
  public: 'bg-teal-100 text-teal-700',
  cabinet: 'bg-amber-100 text-amber-700',
};

function CredibilityStars({ value }: { value: number }) {
  const labels = ['', 'Faible', 'Modérée', 'Correcte', 'Bonne', 'Excellente'];
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} className={`w-5 h-5 ${i <= value ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-sm font-medium text-gray-600">
        Crédibilité {labels[value]} ({value}/5)
      </span>
    </div>
  );
}

export default function OfferDetailPage() {
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'details' | 'lettre' | 'news' | 'alumni'>('details');

  // Reactive applications from useSyncExternalStore
  const allApplications = useApplications();
  const application = useMemo(
    () => allApplications.find((a) => a.offerId === params.id),
    [allApplications, params.id]
  );

  const offer = OFFERS.find((o) => o.id === params.id);

  // Derive cover letter purely — no side-effects needed
  const coverLetter = useMemo(() => {
    if (!offer) return '';
    return generateCoverLetter(offer, getProfile());
  }, [offer]);

  if (!offer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 text-lg">Offre introuvable.</p>
        <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline">
          Retour aux offres
        </Link>
      </div>
    );
  }

  const news = COMPANY_NEWS.filter((n) => n.company === offer.company);
  const alumni = ALUMNI.filter((a) => a.company === offer.company);
  const initials = offer.company.split(' ').slice(0, 2).map((w) => w[0]).join('');

  const handleStatusChange = (status: ApplicationStatus) => {
    updateApplicationStatus(offer.id, status);
  };

  const handleRemoveApplication = () => {
    removeApplication(offer.id);
  };

  const tabs = [
    { key: 'details', label: 'Description', count: null },
    { key: 'lettre', label: 'Lettre de motivation', count: null },
    { key: 'news', label: 'Actualités', count: news.length },
    { key: 'alumni', label: 'Alumni RSB', count: alumni.length },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour aux offres
      </Link>

      <div className="flex gap-8 items-start">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{offer.title}</h1>
                    <p className="text-lg text-gray-500 mt-1">{offer.company}</p>
                  </div>
                  <CredibilityStars value={offer.credibility} />
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${COMPANY_TYPE_COLORS[offer.companyType]}`}>
                    {COMPANY_TYPE_LABELS[offer.companyType]}
                  </span>
                  <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600">📍 {offer.location}</span>
                  <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600">🕐 {offer.duration}</span>
                  <span className="text-sm px-3 py-1 rounded-full bg-green-50 text-green-700">💶 {offer.salary.toLocaleString('fr-FR')} €/mois</span>
                  <span className="text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-700">📅 Début : {offer.startDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-semibold text-gray-800 mb-3">Description du poste</h2>
                    <p className="text-gray-600 leading-relaxed">{offer.description}</p>
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-800 mb-3">Profil recherché</h2>
                    <ul className="space-y-2">
                      {offer.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-gray-600 text-sm">
                          <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-800 mb-3">À propos de {offer.company}</h2>
                    <p className="text-gray-600 leading-relaxed">{offer.companyDescription}</p>
                    {offer.companyWebsite && (
                      <a href={offer.companyWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm text-indigo-600 hover:underline">
                        Visiter le site web
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-800 mb-2">Tags</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {offer.tags.map((tag) => (
                        <span key={tag} className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'lettre' && <CoverLetter text={coverLetter} />}
              {activeTab === 'news' && <CompanyNewsSection news={news} />}
              {activeTab === 'alumni' && <AlumniList alumni={alumni} companyName={offer.company} />}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 shrink-0 space-y-4 sticky top-20">
          <ApplicationTracker
            offerId={offer.id}
            application={application}
            onStatusChange={handleStatusChange}
            onRemove={handleRemoveApplication}
          />
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Offre publiée le</p>
            <p className="text-sm text-gray-700">
              {new Date(offer.postedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
