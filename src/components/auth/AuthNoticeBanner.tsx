import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Copy, Check, ExternalLink, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuthNoticeBanner() {
  const { authNotice, clearAuthNotice } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!authNotice) return null;

  const currentDomain = window.location.hostname;

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(currentDomain);
    setCopied(true);
    toast.success(`Copied domain "${currentDomain}" to clipboard!`);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200/80 p-4 sm:p-5 text-slate-800 shadow-sm transition-all animate-fadeIn">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900">
              {authNotice.title}
            </h3>
            <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
              {authNotice.message}
            </p>

            {authNotice.type === 'unauthorized-domain' && (
              <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-amber-900 font-semibold">Your Current Domain:</span>
                  <code className="bg-amber-100/90 text-amber-950 font-mono px-2.5 py-1 rounded-lg border border-amber-200 text-xs font-bold select-all">
                    {currentDomain}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyDomain}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-medium text-xs hover:bg-amber-100/50 transition-colors shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Domain'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-amber-800 space-y-1">
                  <p className="font-semibold text-amber-900">How to authorize in Firebase Console:</p>
                  <ol className="list-decimal list-inside space-y-0.5 pl-1">
                    <li>Open <strong>Firebase Console</strong> → Select your project</li>
                    <li>Navigate to <strong>Authentication</strong> → <strong>Settings</strong> tab</li>
                    <li>Under <strong>Authorized domains</strong>, click <strong>Add domain</strong> and paste <code className="bg-amber-100 px-1 rounded">{currentDomain}</code></li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={clearAuthNotice}
          className="p-1 rounded-lg text-amber-600 hover:text-amber-900 hover:bg-amber-100 transition-colors shrink-0"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
