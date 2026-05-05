'use client';

import type { Alumni } from '@/lib/types';

interface AlumniListProps {
  alumni: Alumni[];
  companyName: string;
}

const AVATAR_COLORS = [
  'from-pink-500 to-rose-600',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-indigo-500 to-blue-600',
];

export default function AlumniList({ alumni, companyName }: AlumniListProps) {
  if (alumni.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Alumni Rennes SB chez {companyName}
        </h2>
        <p className="text-sm text-gray-500">
          Aucun alumni de Rennes School of Business recensé chez cet employeur pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Alumni Rennes SB chez {companyName}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {alumni.length} ancien{alumni.length > 1 ? 's' : ''} étudiant{alumni.length > 1 ? 's' : ''} dans cette entreprise
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {alumni.map((person, idx) => (
          <div key={person.id} className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                AVATAR_COLORS[idx % AVATAR_COLORS.length]
              } flex items-center justify-center text-white font-bold text-sm shrink-0`}
            >
              {person.avatarInitials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm text-gray-900">{person.name}</p>
                <span className="text-xs text-gray-400 shrink-0">Promo {person.graduationYear}</span>
              </div>
              <p className="text-xs text-gray-500">{person.role}</p>
              <p className="text-xs text-indigo-500 mt-0.5">{person.program}</p>
            </div>

            {/* LinkedIn */}
            {person.linkedinUrl && person.linkedinUrl !== '#' && (
              <a
                href={person.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 shrink-0"
                title="Voir le profil LinkedIn"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            )}
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-indigo-50 border-t border-indigo-100">
        <p className="text-xs text-indigo-600">
          🎓 Ces anciens étudiants de Rennes SB peuvent être de précieux contacts pour décrocher un entretien.
        </p>
      </div>
    </div>
  );
}
