'use client';

import { useState } from 'react';

interface CoverLetterProps {
  text: string;
}

export default function CoverLetter({ text }: CoverLetterProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = async () => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — fall back to execCommand
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          setCopyError(true);
          setTimeout(() => setCopyError(false), 3000);
        }
      } catch {
        setCopyError(true);
        setTimeout(() => setCopyError(false), 3000);
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 className="font-semibold text-gray-800">Lettre de motivation générée</h2>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
            copied
              ? 'bg-green-100 text-green-700'
              : copyError
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copié !
            </>
          ) : copyError ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Échec de la copie
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copier
            </>
          )}
        </button>
      </div>
      <div className="p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
          {text}
        </pre>
      </div>
      <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
        <p className="text-xs text-amber-700">
          💡 Cette lettre est générée automatiquement. Personnalisez-la depuis votre profil en modifiant vos informations et compétences.
        </p>
      </div>
    </div>
  );
}
