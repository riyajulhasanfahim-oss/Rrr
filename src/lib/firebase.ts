import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported } from "firebase/analytics";
import config from "../../firebase-applet-config.json";

// Direct Firebase configuration for rjworldbdcom
export const firebaseConfig = {
  apiKey: "AIzaSyDQLuvLjcIwkOYBgN6V80gT1Lk3q-KmNoY",
  authDomain: "rjworldbdcom.firebaseapp.com",
  databaseURL: "https://rjworldbdcom-default-rtdb.firebaseio.com",
  projectId: "rjworldbdcom",
  storageBucket: "rjworldbdcom.firebasestorage.app",
  messagingSenderId: "743174693139",
  appId: "1:743174693139:web:47bae77e08dd3880b57ae6",
  measurementId: "G-0E1W86N8WZ"
};

console.log('[Firebase Initialized]', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  hasApiKey: Boolean(firebaseConfig.apiKey)
});

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const databaseId = (config as any).firestoreDatabaseId;

let firestoreInstance;
try {
  const firestoreSettings: any = {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  };
  firestoreInstance = databaseId
    ? initializeFirestore(app, firestoreSettings, databaseId)
    : initializeFirestore(app, firestoreSettings);
} catch (e) {
  firestoreInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export const db = firestoreInstance;
export const storage = getStorage(app);
export const rtdb = getDatabase(app, firebaseConfig.databaseURL);
export const RTDB_BASE_URL = (firebaseConfig.databaseURL ? firebaseConfig.databaseURL.replace(/\/$/, '') : `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`);

let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      // analytics disabled
    }
  }).catch(() => {
    // Analytics is optional in unsupported environments (e.g. headless/iframe)
  });
}

export { analytics };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code || 'unknown';

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    }
  };

  console.error(`[Firestore ${operationType.toUpperCase()} Error at "${path}"]:`, {
    code: errCode,
    message: errMsg,
    project: firebaseConfig.projectId,
    userId: auth.currentUser?.uid || 'unauthenticated',
    details: errInfo
  });

  if (errCode === 'permission-denied') {
    console.warn(`[Firestore Tip] Check firestore.rules for path "${path}". Ensure current user has read/write permissions.`);
  } else if (errCode === 'unavailable' || errMsg.includes('transport errored') || errMsg.includes('offline')) {
    console.warn(`[Firestore Tip] Firestore connection unavailable. Check internet connectivity and ensure Firestore Database is created in project "${firebaseConfig.projectId}".`);
  }

  throw new Error(JSON.stringify(errInfo));
}
