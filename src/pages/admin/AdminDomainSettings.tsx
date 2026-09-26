import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink, 
  Lock, 
  Key, 
  Server,
  Info,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { 
  getDomainSettings, 
  saveDomainSettings, 
  checkDomainStatus, 
  normalizeDomain, 
  normalizeWebsiteUrl,
  validateDomain,
  validateWebsiteUrl,
  detectOauthRedirectUri,
  DomainSettings,
  DEFAULT_DOMAIN_SETTINGS,
  PROJECT_AUTH_DOMAIN,
  PROJECT_OAUTH_CLIENT_ID
} from '../../services/domainSettingsService';

export default function AdminDomainSettings() {
  const { userData, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [primaryDomain, setPrimaryDomain] = useState(DEFAULT_DOMAIN_SETTINGS.primaryDomain);
  const [websiteUrl, setWebsiteUrl] = useState(DEFAULT_DOMAIN_SETTINGS.websiteUrl);
  const [authorizedDomain, setAuthorizedDomain] = useState(DEFAULT_DOMAIN_SETTINGS.authorizedDomain);
  const [oauthRedirectUri, setOauthRedirectUri] = useState(DEFAULT_DOMAIN_SETTINGS.oauthRedirectUri);
  const [status, setStatus] = useState<'Connected' | 'Not Connected'>('Connected');
  const [lastChecked, setLastChecked] = useState<string>(new Date().toISOString());
  const [clientSecret, setClientSecret] = useState('');
  const [hasServerClientSecret, setHasServerClientSecret] = useState(false);
  const [showSecretInput, setShowSecretInput] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getDomainSettings();
      setPrimaryDomain(data.primaryDomain || 'rjworldbd.com');
      setWebsiteUrl(data.websiteUrl || 'https://rjworldbd.com');
      setAuthorizedDomain(data.authorizedDomain || data.primaryDomain || 'rjworldbd.com');
      setOauthRedirectUri(data.oauthRedirectUri || detectOauthRedirectUri(data.primaryDomain || 'rjworldbd.com'));
      setStatus(data.status || 'Connected');
      setLastChecked(data.lastChecked || new Date().toISOString());
      if (data.hasClientSecret) {
        setHasServerClientSecret(true);
      }
    } catch (err) {
      console.error('Failed to load domain settings:', err);
      toast.error('Failed to load current domain configuration');
    } finally {
      setLoading(false);
    }
  };

  // Automatically update suggested website URL and OAuth Redirect URI when Primary Domain changes
  const handlePrimaryDomainChange = (val: string) => {
    setPrimaryDomain(val);
    const cleaned = normalizeDomain(val);
    if (cleaned) {
      setWebsiteUrl(`https://${cleaned}`);
      setAuthorizedDomain(cleaned);
      setOauthRedirectUri(detectOauthRedirectUri(cleaned));
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCheckConnection = async () => {
    try {
      setCheckingStatus(true);
      const res = await checkDomainStatus(primaryDomain);
      setStatus(res.connected ? 'Connected' : 'Not Connected');
      setLastChecked(res.checkedAt);
      if (res.connected) {
        toast.success(res.message || 'Domain is connected and responding via HTTPS');
      } else {
        toast.error(res.message || 'Domain is not connected. Please verify DNS');
      }
    } catch {
      toast.error('Could not verify domain status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Validate Primary Domain
    const domainVal = validateDomain(primaryDomain);
    if (!domainVal.isValid) {
      toast.error(domainVal.error || 'Invalid Primary Domain');
      return;
    }

    // 2. Validate Website URL
    const urlVal = validateWebsiteUrl(websiteUrl);
    if (!urlVal.isValid) {
      toast.error(urlVal.error || 'Invalid Website URL');
      return;
    }

    // 3. Validate Authorized Domain
    const authVal = validateDomain(authorizedDomain);
    if (!authVal.isValid) {
      toast.error(authVal.error || 'Invalid Authorized Domain');
      return;
    }

    try {
      setSaving(true);
      const res = await saveDomainSettings({
        primaryDomain,
        websiteUrl,
        authorizedDomain,
        clientSecret: clientSecret.trim() ? clientSecret.trim() : undefined
      }, userData?.name || user?.email || 'Admin');

      if (res.success) {
        setPrimaryDomain(res.settings.primaryDomain);
        setWebsiteUrl(res.settings.websiteUrl);
        setAuthorizedDomain(res.settings.authorizedDomain);
        setOauthRedirectUri(res.settings.oauthRedirectUri);
        setStatus(res.settings.status);
        setLastChecked(res.settings.lastChecked);
        if (clientSecret.trim()) {
          setHasServerClientSecret(true);
          setClientSecret('');
          setShowSecretInput(false);
        }
        toast.success(res.message || 'Domain settings saved successfully');
      }
    } catch (err: any) {
      console.error('Error saving domain settings:', err);
      toast.error(err.message || 'Failed to save domain settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-main flex items-center justify-center shadow-xs">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Domain Settings</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage your marketplace primary domain, authorized URLs, and Google OAuth callback handlers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCheckConnection}
            disabled={checkingStatus}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
            <span>{checkingStatus ? 'Checking...' : 'Check Status'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-primary-main hover:bg-primary-dark rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving...' : 'Save Domain Settings'}</span>
          </button>
        </div>
      </div>

      {/* Domain Status Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Platform Status</span>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-lg font-bold text-slate-900">Domain Status</h2>
              
              {/* Status Badge */}
              <div 
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  status === 'Connected' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span>{status}</span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-500">
            <span>Last verified: </span>
            <span className="font-semibold text-slate-700">
              {lastChecked ? new Date(lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
            </span>
          </div>
        </div>

        {/* Status Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Configured Domain</span>
            <p className="text-sm font-bold text-slate-900 mt-1 truncate">{primaryDomain || 'rjworldbd.com'}</p>
            <span className="inline-block mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Primary Host</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Protocol Security</span>
            <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>HTTPS Active</span>
            </p>
            <span className="inline-block mt-2 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">TLS / SSL</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Google Auth Integration</span>
            <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Callback Ready</span>
            </p>
            <span className="inline-block mt-2 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">OAuth 2.0</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Server Credentials</span>
            <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-600" />
              <span>{hasServerClientSecret ? 'Configured' : 'Default / Standard'}</span>
            </p>
            <span className="inline-block mt-2 text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md">Secure Storage</span>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Domain Configuration Fields</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">All fields validated on save</span>
        </div>

        <div className="p-6 space-y-6">
          
          {/* 1. Primary Domain */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-slate-900">
                1. Primary Domain
              </label>
              <span className="text-xs text-slate-500">Example: rjworldbd.com</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                value={primaryDomain}
                onChange={(e) => handlePrimaryDomainChange(e.target.value)}
                placeholder="rjworldbd.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => handleCopy(primaryDomain, 'Primary Domain')}
                className="absolute right-2 px-2 py-1 text-slate-400 hover:text-slate-700 transition-colors"
                title="Copy Primary Domain"
              >
                {copiedField === 'Primary Domain' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              The canonical domain where your marketplace is hosted. Automatically normalized (lowercase, without http/https).
            </p>
          </div>

          {/* 2. Website URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-slate-900">
                2. Website URL
              </label>
              <span className="text-xs text-slate-500">Example: https://rjworldbd.com</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://rjworldbd.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => handleCopy(websiteUrl, 'Website URL')}
                className="absolute right-2 px-2 py-1 text-slate-400 hover:text-slate-700 transition-colors"
                title="Copy Website URL"
              >
                {copiedField === 'Website URL' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              The public web address of your storefront. Must use secure HTTPS protocol.
            </p>
          </div>

          {/* 3. Authorized Domain */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-slate-900">
                3. Authorized Domain
              </label>
              <span className="text-xs text-slate-500">Example: rjworldbd.com</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                value={authorizedDomain}
                onChange={(e) => setAuthorizedDomain(e.target.value)}
                placeholder="rjworldbd.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => handleCopy(authorizedDomain, 'Authorized Domain')}
                className="absolute right-2 px-2 py-1 text-slate-400 hover:text-slate-700 transition-colors"
                title="Copy Authorized Domain"
              >
                {copiedField === 'Authorized Domain' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              The domain whitelisted in Google Cloud Console OAuth consent screen and Firebase Authentication.
            </p>
          </div>

          {/* 4. OAuth Redirect URI */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-slate-900">
                4. OAuth Redirect URI
              </label>
              <span className="text-xs font-semibold text-primary-main bg-primary-50 px-2 py-0.5 rounded">
                Detected Project Callback
              </span>
            </div>
            
            {/* Primary Custom Domain Callback */}
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={oauthRedirectUri}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm font-mono text-slate-800 focus:outline-none cursor-text select-all"
              />
              <button
                type="button"
                onClick={() => handleCopy(oauthRedirectUri, 'OAuth Redirect URI')}
                className="absolute right-2 px-2.5 py-1 text-xs font-bold text-primary-main bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                {copiedField === 'OAuth Redirect URI' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Fallback Firebase Auth Handler */}
            <div className="pt-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Default Firebase Auth Handler:</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`https://${PROJECT_AUTH_DOMAIN}/__/auth/handler`, 'Firebase Default Callback')}
                  className="text-primary-main hover:underline flex items-center gap-1 font-semibold"
                >
                  <Copy className="w-3 h-3" /> Copy Default
                </button>
              </div>
              <p className="text-xs font-mono bg-slate-100/70 px-3 py-1.5 rounded-lg text-slate-600 select-all">
                https://{PROJECT_AUTH_DOMAIN}/__/auth/handler
              </p>
            </div>

            <p className="text-xs text-slate-500 pt-1">
              Add both the Primary Custom Domain URI and the Firebase Auth Handler URI into Google Cloud Console &gt; APIs &amp; Services &gt; Credentials &gt; OAuth 2.0 Client IDs.
            </p>
          </div>

          {/* Optional Server-Side Google Client Secret (Sensitive credentials kept secure) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-bold text-slate-900">Server-Side OAuth Secret Storage</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSecretInput(!showSecretInput)}
                className="text-xs text-primary-main hover:underline font-semibold"
              >
                {showSecretInput ? 'Hide' : (hasServerClientSecret ? 'Update Secret' : 'Configure Secret')}
              </button>
            </div>

            {showSecretInput && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mb-2">
                <p className="text-xs text-slate-600">
                  Store sensitive Google OAuth credentials safely on the backend server. The secret is never sent to or exposed in the frontend browser.
                </p>
                <div className="relative">
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Enter Google Client Secret (stored server-side only)"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-primary-main"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCheckConnection}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Test Connection
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-main hover:bg-primary-dark text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Save Domain Settings'}</span>
            </button>
          </div>

        </div>
      </form>

      {/* Professional Google Authentication Setup Guide */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Google OAuth &amp; Firebase Console Whitelist Checklist</h3>
            <p className="text-xs text-slate-500">Ensure these exact entries are saved in your Google Cloud &amp; Firebase accounts.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          
          {/* Step 1: Firebase Authorized Domains */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center">1</span>
                Firebase Console &gt; Authentication &gt; Settings
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Under <strong>Authorized domains</strong>, click <em>Add domain</em> and enter:
            </p>
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <code className="text-xs font-mono font-bold text-slate-900">{primaryDomain || 'rjworldbd.com'}</code>
              <button
                type="button"
                onClick={() => handleCopy(primaryDomain || 'rjworldbd.com', 'Firebase Authorized Domain')}
                className="text-xs text-primary-main hover:underline font-semibold"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Step 2: Google Cloud Console OAuth 2.0 Client */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center">2</span>
                Google Cloud Console &gt; APIs &amp; Services &gt; Credentials
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Edit your Web OAuth 2.0 Client ID and add to <strong>Authorized redirect URIs</strong>:
            </p>
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <code className="text-xs font-mono font-bold text-slate-900 truncate max-w-[240px]">{oauthRedirectUri}</code>
              <button
                type="button"
                onClick={() => handleCopy(oauthRedirectUri, 'Google Cloud Redirect URI')}
                className="text-xs text-primary-main hover:underline font-semibold shrink-0 ml-2"
              >
                Copy
              </button>
            </div>
          </div>

        </div>

        {PROJECT_OAUTH_CLIENT_ID && (
          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Active Project Google Client ID:</span>
              <p className="font-mono text-[11px] text-blue-800 break-all select-all mt-0.5">
                {PROJECT_OAUTH_CLIENT_ID}
              </p>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
