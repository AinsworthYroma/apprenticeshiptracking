'use client';

import type { CompanyNews } from '@/lib/types';

interface CompanyNewsProps {
  news: CompanyNews[];
}

const TYPE_COLORS: Record<string, string> = {
  recruitment: 'bg-blue-100 text-blue-700',
  finance: 'bg-green-100 text-green-700',
  innovation: 'bg-purple-100 text-purple-700',
  rse: 'bg-teal-100 text-teal-700',
  general: 'bg-gray-100 text-gray-600',
};

const TYPE_LABELS: Record<string, string> = {
  recruitment: '🧑‍💼 Recrutement',
  finance: '📈 Finance',
  innovation: '💡 Innovation',
  rse: '🌿 RSE',
  general: '📰 Actualité',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function CompanyNewsSection({ news }: CompanyNewsProps) {
  if (news.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          Actualités de l&apos;entreprise
        </h2>
        <p className="text-sm text-gray-500">Aucune actualité disponible pour cette entreprise.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          Actualités de l&apos;entreprise
        </h2>
      </div>
      <div className="divide-y divide-gray-100">
        {news.map((item) => (
          <div key={item.id} className="p-5 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.type]}`}
                  >
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(item.date)}</span>
                </div>
                <h3 className="font-medium text-gray-900 text-sm leading-snug">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.summary}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Source : {item.source}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
