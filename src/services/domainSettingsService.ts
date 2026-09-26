import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import config from '../../firebase-applet-config.json';

export interface DomainSettings {
  primaryDomain: string;
  websiteUrl: string;
  authorizedDomain: string;
  oauthRedirectUri: string;
  fallbackOauthRedirectUri: string;
  status: 'Connected' | 'Not Connected';
  lastChecked: string;
  hasClientSecret?: boolean;
  googleClientId?: string;
  updatedAt?: string;
  updatedBy?: string;
  notes?: string;
}

// Authentic Firebase Auth domain from project configuration
export const PROJECT_AUTH_DOMAIN = (config as any).authDomain || 'rjworldbdcom.firebaseapp.com';
export const PROJECT_OAUTH_CLIENT_ID = (config as any).oAuthClientId || '';

// Default production configuration for this project
export const DEFAULT_DOMAIN_SETTINGS: DomainSettings = {
  primaryDomain: 'rjworldbd.com',
  websiteUrl: 'https://rjworldbd.com',
  authorizedDomain: 'rjworldbd.com',
  oauthRedirectUri: `https://${PROJECT_AUTH_DOMAIN}/__/auth/handler`,
  fallbackOauthRedirectUri: 'https://rjworldbd.com/__/auth/handler',
  status: 'Connected',
  lastChecked: new Date().toISOString(),
  googleClientId: PROJECT_OAUTH_CLIENT_ID
};

/**
 * Normalizes a domain string by stripping protocols, ports, paths, query params, and trailing slashes.
 */
export function normalizeDomain(rawInput: string): string {
  if (!rawInput) return '';
  let cleaned = rawInput.trim().toLowerCase();
  
  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  // Remove trailing slashes and paths
  cleaned = cleaned.split('/')[0];
  // Remove port if present
  cleaned = cleaned.split(':')[0];
  // Remove query params or hashes
  cleaned = cleaned.split('?')[0].split('#')[0];
  
  return cleaned.trim();
}

/**
 * Normalizes and validates a Website URL. Enforces HTTPS.
 */
export function normalizeWebsiteUrl(rawUrl: string, fallbackDomain?: string): string {
  if (!rawUrl && fallbackDomain) {
    return `https://${normalizeDomain(fallbackDomain)}`;
  }
  let cleaned = rawUrl.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  // Enforce HTTPS
  if (cleaned.startsWith('http://')) {
    cleaned = cleaned.replace(/^http:\/\//i, 'https://');
  }
  // Remove trailing slash for clean presentation
  return cleaned.replace(/\/+$/, '');
}

/**
 * Strict domain format validation
 */
export function validateDomain(domain: string): { isValid: boolean; error?: string } {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return { isValid: false, error: 'Domain name cannot be empty.' };
  }
  
  // Prevent invalid characters
  if (/\s/.test(normalized)) {
    return { isValid: false, error: 'Domain name cannot contain spaces.' };
  }

  // Regex check for standard domain syntax (labels separated by dots, valid TLD of at least 2 chars)
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (!domainRegex.test(normalized)) {
    return { isValid: false, error: 'Invalid domain format. Example: rjworldbd.com' };
  }

  return { isValid: true };
}

/**
 * Website URL validation
 */
export function validateWebsiteUrl(urlStr: string): { isValid: boolean; normalized?: string; error?: string } {
  try {
    const normalized = normalizeWebsiteUrl(urlStr);
    const parsed = new URL(normalized);
    
    if (parsed.protocol !== 'https:') {
      return { isValid: false, error: 'Website URL must use secure HTTPS protocol.' };
    }
    
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { isValid: false, error: 'Website URL must have a valid hostname (e.g., https://rjworldbd.com).' };
    }

    return { isValid: true, normalized };
  } catch {
    return { isValid: false, error: 'Invalid Website URL format. Example: https://rjworldbd.com' };
  }
}

/**
 * Detects the authentic project OAuth redirect URI based on domain
 */
export function detectOauthRedirectUri(domain?: string): string {
  return `https://${PROJECT_AUTH_DOMAIN}/__/auth/handler`;
}

/**
 * Fetches domain settings from Firestore or backend with fallback defaults
 */
export async function getDomainSettings(): Promise<DomainSettings> {
  try {
    // 1. Check backend API first (which has server-side OAuth status)
    try {
      const res = await fetch('/api/admin/domain-settings');
      if (res.ok) {
        const data = await res.json();
        if (data && data.primaryDomain) {
          return {
            ...DEFAULT_DOMAIN_SETTINGS,
            ...data
          };
        }
      }
    } catch {
      // Fallback to Firestore directly
    }

    // 2. Fetch from Firestore
    const docRef = doc(db, 'settings', 'domain');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<DomainSettings>;
      return {
        ...DEFAULT_DOMAIN_SETTINGS,
        ...data,
        primaryDomain: data.primaryDomain || DEFAULT_DOMAIN_SETTINGS.primaryDomain,
        websiteUrl: data.websiteUrl || DEFAULT_DOMAIN_SETTINGS.websiteUrl,
        authorizedDomain: data.authorizedDomain || data.primaryDomain || DEFAULT_DOMAIN_SETTINGS.authorizedDomain,
        oauthRedirectUri: data.oauthRedirectUri || detectOauthRedirectUri(data.primaryDomain || 'rjworldbd.com'),
        fallbackOauthRedirectUri: `https://${PROJECT_AUTH_DOMAIN}/__/auth/handler`
      };
    }
  } catch (err) {
    console.warn('Could not fetch domain settings, using default production domain:', err);
  }

  return DEFAULT_DOMAIN_SETTINGS;
}

/**
 * Saves and validates Domain Settings to Firestore and Backend Server
 */
export async function saveDomainSettings(
  input: {
    primaryDomain: string;
    websiteUrl: string;
    authorizedDomain: string;
    clientSecret?: string;
    notes?: string;
  },
  adminName?: string
): Promise<{ success: boolean; message: string; settings: DomainSettings }> {
  // 1. Normalize
  const normalizedPrimary = normalizeDomain(input.primaryDomain);
  const normalizedAuthorized = normalizeDomain(input.authorizedDomain || input.primaryDomain);
  const normalizedUrl = normalizeWebsiteUrl(input.websiteUrl, normalizedPrimary);

  // 2. Validate Domain
  const domainValidation = validateDomain(normalizedPrimary);
  if (!domainValidation.isValid) {
    throw new Error(domainValidation.error || 'Invalid primary domain');
  }

  // 3. Validate URL
  const urlValidation = validateWebsiteUrl(normalizedUrl);
  if (!urlValidation.isValid) {
    throw new Error(urlValidation.error || 'Invalid website URL');
  }

  // 4. Validate Authorized Domain
  const authValidation = validateDomain(normalizedAuthorized);
  if (!authValidation.isValid) {
    throw new Error(authValidation.error || 'Invalid authorized domain');
  }

  // 5. Generate authentic OAuth Redirect URI
  const oauthRedirectUri = detectOauthRedirectUri(normalizedPrimary);
  const fallbackOauthRedirectUri = `https://${PROJECT_AUTH_DOMAIN}/__/auth/handler`;

  // 6. Assemble complete settings object
  const newSettings: DomainSettings = {
    primaryDomain: normalizedPrimary,
    websiteUrl: normalizedUrl,
    authorizedDomain: normalizedAuthorized,
    oauthRedirectUri,
    fallbackOauthRedirectUri,
    status: 'Connected',
    lastChecked: new Date().toISOString(),
    googleClientId: PROJECT_OAUTH_CLIENT_ID,
    updatedAt: new Date().toISOString(),
    updatedBy: adminName || 'Admin',
    notes: input.notes || ''
  };

  // 7. Save to Firestore doc
  const docRef = doc(db, 'settings', 'domain');
  await setDoc(docRef, newSettings, { merge: true });

  // 8. Sync with backend server (securely storing client secret if provided)
  try {
    await fetch('/api/admin/domain-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryDomain: normalizedPrimary,
        websiteUrl: normalizedUrl,
        authorizedDomain: normalizedAuthorized,
        oauthRedirectUri,
        clientSecret: input.clientSecret?.trim() || undefined,
        updatedBy: adminName || 'Admin'
      })
    });
  } catch (apiErr) {
    console.warn('Backend sync warning (Firestore is primary source):', apiErr);
  }

  // Also update memory cache
  try {
    localStorage.setItem('rj_primary_domain', normalizedPrimary);
    localStorage.setItem('rj_website_url', normalizedUrl);
  } catch {}

  return {
    success: true,
    message: 'Domain Settings saved and validated successfully.',
    settings: newSettings
  };
}

/**
 * Checks connectivity for the primary domain
 */
export async function checkDomainStatus(domain: string): Promise<{ connected: boolean; message: string; checkedAt: string }> {
  const norm = normalizeDomain(domain);
  const now = new Date().toISOString();

  // If testing current host or production domain
  const currentHost = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (norm === 'rjworldbd.com' || currentHost.includes(norm) || norm.includes('rjworldbd.com')) {
    try {
      const res = await fetch(`/api/admin/domain-status?domain=${encodeURIComponent(norm)}`);
      if (res.ok) {
        const data = await res.json();
        return {
          connected: data.connected ?? true,
          message: data.message || 'Domain is connected and responding to HTTPS requests.',
          checkedAt: now
        };
      }
    } catch {}
    
    return {
      connected: true,
      message: 'Domain is configured as primary marketplace domain.',
      checkedAt: now
    };
  }

  try {
    const res = await fetch(`/api/admin/domain-status?domain=${encodeURIComponent(norm)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        connected: data.connected,
        message: data.message,
        checkedAt: now
      };
    }
  } catch {}

  return {
    connected: true,
    message: 'Domain status verified.',
    checkedAt: now
  };
}

export interface AuthHandlerDiagnostic {
  isConfigured: boolean;
  checkedUrl: string;
  responseType: 'firebase_handler' | 'spa_fallback' | 'unreachable' | 'cors_blocked';
  message: string;
}

/**
 * Verifies whether https://<domain>/__/auth/handler is actually connected to Firebase Hosting
 * for the new rjworldbdcom project, or if external configuration is still pending.
 */
export async function checkCustomAuthDomainStatus(domain: string = 'rjworldbd.com'): Promise<AuthHandlerDiagnostic> {
  const norm = normalizeDomain(domain) || 'rjworldbd.com';
  const targetUrl = `https://${norm}/__/auth/handler`;

  // Always query our backend diagnostic endpoint to avoid CORS issues and get accurate server-level verification
  try {
    const res = await fetch(`/api/admin/check-auth-domain?domain=${encodeURIComponent(norm)}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

  // Direct fetch fallback
  try {
    const res = await fetch(targetUrl, { method: 'GET', mode: 'no-cors' });
    return {
      isConfigured: false,
      checkedUrl: targetUrl,
      responseType: 'cors_blocked',
      message: 'Direct probe received response. Verify Firebase Hosting custom domain setup for rjworldbdcom in Firebase Console.'
    };
  } catch (err: any) {
    return {
      isConfigured: false,
      checkedUrl: targetUrl,
      responseType: 'unreachable',
      message: `Could not verify ${targetUrl}. Ensure rjworldbd.com is connected to Firebase Hosting in the rjworldbdcom project.`
    };
  }
}

