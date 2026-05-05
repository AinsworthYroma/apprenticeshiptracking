'use client';

import { useState, useCallback } from 'react';
import { getProfile, saveProfile } from '@/lib/storage';
import type { UserProfile } from '@/lib/types';

// Lazy init: only read localStorage once during initial render (client only)
function initProfile(): UserProfile {
  return getProfile();
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(initProfile);
  const [saved, setSaved] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  const handleChange = useCallback(
    (field: keyof UserProfile, value: string | number) => {
      setProfile((prev) => ({ ...prev, [field]: value }));
      setSaved(false);
    },
    []
  );

  const handleSave = () => {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !profile.skills.includes(trimmed)) {
      setProfile((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
      setNewSkill('');
      setSaved(false);
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setProfile((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
    setSaved(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mon profil</h1>
        <p className="mt-2 text-gray-500">
          Ces informations sont utilisées pour générer vos lettres de motivation personnalisées.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {/* Personal info */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 mb-4">Informations personnelles</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Prénom</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Téléphone</label>
              <input
                type="tel"
                value={profile.phone ?? ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+33 6 XX XX XX XX"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">LinkedIn URL</label>
              <input
                type="url"
                value={profile.linkedinUrl ?? ''}
                onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* School info */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 mb-4">Formation</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">École</label>
            <input
              type="text"
              value={profile.school}
              onChange={(e) => handleChange('school', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Programme / Spécialisation</label>
            <input
              type="text"
              value={profile.program}
              onChange={(e) => handleChange('program', e.target.value)}
              placeholder="ex: MSc Marketing & Commerce International"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Année de diplôme prévue</label>
            <input
              type="number"
              value={profile.graduationYear}
              onChange={(e) => handleChange('graduationYear', parseInt(e.target.value))}
              min={2024}
              max={2030}
              className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Skills */}
        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Compétences clés</h2>
          <p className="text-xs text-gray-400 mb-4">Apparaîtront dans vos lettres de motivation</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.skills.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-1 text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                {skill}
                <button onClick={() => handleRemoveSkill(skill)} className="text-indigo-400 hover:text-indigo-600 transition-colors ml-0.5">
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
              placeholder="Ajouter une compétence…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={handleAddSkill} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors px-4 py-2 rounded-lg text-sm font-medium">
              Ajouter
            </button>
          </div>
        </div>

        {/* Save */}
        <div className="px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Les données sont sauvegardées localement dans votre navigateur.
          </p>
          <button
            onClick={handleSave}
            className={`px-6 py-2 rounded-xl font-medium text-sm transition-all ${
              saved ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}
