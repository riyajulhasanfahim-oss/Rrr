import React, { useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, Copy, ExternalLink, ShieldCheck, Flame, Server, ListPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { firebaseConfig, db } from '../../lib/firebase';
import { seedAllCollections } from '../../lib/firebaseSeed';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { rtdbGet } from '../../lib/rtdb';

export default function AdminFirebaseSettings() {
  const [seeding, setSeeding] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    connected: boolean;
    message: string;
    details?: any;
  }>({
    tested: false,
    connected: false,
    message: ''
  });
  const [seedResult, setSeedResult] = useState<{
    completed: boolean;
    seeded: string[];
    failed: string[];
  } | null>(null);

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      let rtdbOk = false;
      try {
        await rtdbGet('categories');
        rtdbOk = true;
      } catch (rErr) {
        console.warn('RTDB test note:', rErr);
      }

      let firestoreOk = false;
      try {
        const testQuery = query(collection(db, 'banners'), limit(1));
        await getDocs(testQuery);
        firestoreOk = true;
      } catch (fErr: any) {
        console.warn('Firestore test note:', fErr);
      }

      if (rtdbOk || firestoreOk) {
        setConnectionStatus({
          tested: true,
          connected: true,
          message: `Successfully connected to Firebase Project "${firebaseConfig.projectId}". Realtime Database is ${rtdbOk ? 'Active and Responding' : 'Standby'}. Firestore is ${firestoreOk ? 'Active' : 'Standby'}.`
        });
        toast.success('Firebase database connection active!');
      } else {
        setConnectionStatus({
          tested: true,
          connected: false,
          message: `Could not reach database endpoints for "${firebaseConfig.projectId}". Please check your internet connection or Firebase rules.`
        });
        toast.error('Firebase connection failed');
      }
    } catch (err: any) {
      console.error('Connection test error:', err);
      setConnectionStatus({
        tested: true,
        connected: false,
        message: `Error connecting to Firebase: ${err.message}`
      });
      toast.error(`Connection failed: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSeedAll = async (force: boolean = false) => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await seedAllCollections(force);
      setSeedResult({
        completed: true,
        seeded: res.seeded,
        failed: res.failed
      });
      if (res.failed.length === 0) {
        toast.success('সব কালেকশন সফলভাবে তৈরি এবং সিঙ্ক হয়েছে!');
      } else {
        toast.error('কিছু কালেকশন সিঙ্ক করার সময় পারমিশন সংক্রান্ত সমস্যা হয়েছে। ফায়ারবেস রুলস চেক করুন।');
      }
    } catch (err: any) {
      toast.error(`Failed to initialize: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} কপি করা হয়েছে!`);
  };

  const recommendedRules = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isUserAdmin() {
      return isSignedIn() && (
        request.auth.token.email in ['frofficialbd1@gmail.com', 'riyajulhasanfahim@gmail.com'] ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin')
      );
    }

    // Public Readable Catalogs
    match /banners/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /categories/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /brands/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /products/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /coupons/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /couriers/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /ranks/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /settings/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /system_settings/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /referral_codes/{id} { allow read: if true; allow write: if isSignedIn(); }
    match /promo_codes/{id} { allow read: if true; allow write: if isSignedIn(); }

    // Users & Profiles
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update: if isUserAdmin() || (isSignedIn() && request.auth.uid == userId);
      allow delete: if isUserAdmin();
    }

    // Vendors & Stores
    match /vendors/{id} { allow read: if true; allow write: if isUserAdmin() || isSignedIn(); }
    match /vendor_profiles/{id} { allow read: if true; allow write: if isUserAdmin() || isSignedIn(); }
    match /vendor_themes/{id} { allow read: if true; allow write: if isUserAdmin() || isSignedIn(); }
    match /vendor_wallet/{id} { allow read, write: if isUserAdmin() || (isSignedIn() && request.auth.uid == id); }
    match /verified_seller_requests/{id} { allow read, write: if isSignedIn(); }

    // Resellers & Wallets
    match /resellers/{id} { allow read: if true; allow write: if isUserAdmin() || isSignedIn(); }
    match /reseller_wallet/{id} { allow read, write: if isUserAdmin() || (isSignedIn() && request.auth.uid == id); }
    match /commission_rules/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /bonus_rules/{id} { allow read: if true; allow write: if isUserAdmin(); }
    match /commission_transactions/{id} { allow read, write: if isSignedIn(); }
    match /bonus_transactions/{id} { allow read, write: if isSignedIn(); }
    match /withdraw_requests/{id} { allow read, write: if isSignedIn(); }
    match /mlm_members/{id} { allow read, write: if isSignedIn(); }

    // Orders & Payments
    match /orders/{id} { allow read, write: if true; }
    match /vendor_orders/{id} { allow read, write: if true; }
    match /payments/{id} { allow read, write: if true; }
    match /storage_accounts/{id} { allow read, write: if isUserAdmin(); }
  }
}`;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <Flame className="w-6 h-6" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">Firebase & Firestore Database</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            ফায়ারবেস প্রজেক্ট কনফিগারেশন, রিয়েলটাইম স্ট্যাটাস এবং সমস্ত সার্ভিস কালেকশন ইনিশিয়ালাইজার।
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={testConnection}
            disabled={testingConnection}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${testingConnection ? 'animate-spin' : ''}`} />
            Test Connection
          </button>
          <button
            onClick={() => handleSeedAll(false)}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-primary-main hover:bg-primary-dark rounded-xl shadow-sm transition-colors"
          >
            <ListPlus className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
            {seeding ? 'সিঙ্ক হচ্ছে...' : 'সব কালেকশন তৈরি করুন'}
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      {connectionStatus.tested && (
        <div
          className={`p-4 rounded-2xl border ${
            connectionStatus.connected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {connectionStatus.connected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">
              <p className="font-semibold">
                {connectionStatus.connected ? 'Firestore Live Connected' : 'Connection Status / Action Required'}
              </p>
              <p className="mt-0.5 text-xs opacity-90">{connectionStatus.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Project Config Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-slate-500" />
          Active Firebase Project Parameters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <span className="text-xs text-slate-500 block font-medium">Project ID</span>
            <span className="text-sm font-semibold text-slate-800 font-mono select-all">
              {firebaseConfig.projectId}
            </span>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <span className="text-xs text-slate-500 block font-medium">Auth Domain</span>
            <span className="text-sm font-semibold text-slate-800 font-mono select-all truncate block">
              {firebaseConfig.authDomain}
            </span>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <span className="text-xs text-slate-500 block font-medium">Storage Bucket</span>
            <span className="text-sm font-semibold text-slate-800 font-mono select-all truncate block">
              {firebaseConfig.storageBucket}
            </span>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <span className="text-xs text-slate-500 block font-medium">Realtime Database URL</span>
            <span className="text-sm font-semibold text-slate-800 font-mono select-all truncate block">
              {firebaseConfig.databaseURL || 'N/A'}
            </span>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <span className="text-xs text-slate-500 block font-medium">App ID</span>
            <span className="text-sm font-semibold text-slate-800 font-mono select-all truncate block">
              {firebaseConfig.appId}
            </span>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <span className="text-xs text-slate-500 block font-medium">API Key</span>
            <span className="text-sm font-semibold text-slate-800 font-mono">
              ••••••••••••{firebaseConfig.apiKey?.slice(-6)}
            </span>
          </div>
        </div>
      </div>

      {/* Seed Results Display */}
      {seedResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary-main" />
              কালেকশন তৈরি ও সিঙ্কের ফলাফল ({seedResult.seeded.length} কালেকশন সিঙ্কড)
            </h4>
            <button
              onClick={() => handleSeedAll(true)}
              disabled={seeding}
              className="text-xs text-primary-main hover:underline font-medium"
            >
              Force Re-seed All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {seedResult.seeded.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 px-3 py-2 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-mono truncate">{item}</span>
              </div>
            ))}
          </div>

          {seedResult.failed.length > 0 && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                পারমিশন সমস্যার কারণে যে কালেকশনগুলো লেখা যায়নি:
              </h5>
              <div className="space-y-1">
                {seedResult.failed.map((fail, i) => (
                  <p key={i} className="text-xs text-rose-700 font-mono">
                    • {fail}
                  </p>
                ))}
              </div>
              <p className="text-xs text-rose-600 mt-2 font-medium">
                👉 নিচের সেকশন থেকে Firestore Security Rules কপি করে Firebase Console-এ Publish করুন।
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recommended Firestore Security Rules */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="font-semibold text-white">Firestore Security Rules (প্রয়োজনীয় ফায়ারবেস রুলস)</h4>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors border border-slate-700"
            >
              Open Rules in Firebase Console
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => copyToClipboard(recommendedRules, 'Security Rules')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-main hover:bg-primary-dark text-xs font-medium text-white rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Rules
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          আপনার ফায়ারবেস কনসোলের <strong>Firestore Database &gt; Rules</strong> ট্যাবে গিয়ে নিচের কোডটি পেস্ট করে <strong>Publish</strong> বাটনে ক্লিক করুন। এর ফলে ভেন্ডর, রিসেলার, কমিশন, র‍্যাংক, ক্যাটালগ এবং এডমিন অ্যাকাউন্ট (frofficialbd1@gmail.com, riyajulhasanfahim@gmail.com) সব ফিচার সম্পূর্ণ সচল হয়ে যাবে।
        </p>

        <div className="relative">
          <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto max-h-64 border border-slate-800 select-all">
            {recommendedRules}
          </pre>
        </div>
      </div>
    </div>
  );
}
