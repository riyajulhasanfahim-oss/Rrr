import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  onAuthStateChanged,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { rtdbGet, rtdbUpdate, rtdbSubscribe } from '../lib/rtdb';
import { requestAndSaveFCMToken, removeFCMToken, onMessageListener } from '../lib/fcm';
import toast from 'react-hot-toast';
import { checkAccountStatus } from '../services/accountStatusService';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  photo?: string | null;
  role: 'user' | 'Customer' | 'Reseller' | 'Vendor' | 'Admin' | string;
  accountType?: 'general' | 'premium' | string;
  status: 'active' | 'inactive' | 'suspended' | string;
  balance: number;
  wallet?: number;
  language?: string;
  createdAt: any;
  updatedAt?: any;
  isPremium?: boolean;
  hasActiveVendor?: boolean;
  hasActiveReseller?: boolean;
}

export interface AuthNoticeInfo {
  type: 'unauthorized-domain' | 'operation-not-allowed' | 'popup-blocked' | 'general';
  provider: string;
  domain: string;
  title: string;
  message: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  isAdmin: boolean;
  loading: boolean;
  authNotice: AuthNoticeInfo | null;
  clearAuthNotice: () => void;
  signInWithGoogle: () => Promise<User | null>;
  signInWithFacebook: () => Promise<User | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  refreshUserData: () => Promise<UserData | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<AuthNoticeInfo | null>(null);

  const clearAuthNotice = () => setAuthNotice(null);

  // Loads current user's profile from Realtime Database users/{uid}
  const fetchUserData = async (uid: string): Promise<UserData | null> => {
    try {
      const data = await rtdbGet<any>(`users/${uid}`);
      if (data) {
        const userEmail = (data.email || auth.currentUser?.email || '').toLowerCase();
        const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
        const isAdminUser = adminEmails.includes(userEmail) || data.role === 'Admin';
        
        const statusResult = await checkAccountStatus(userEmail, uid);
        
        // Strict role resolution: Authoritative database role with active status verification
        let determinedRole = 'Customer';
        if (isAdminUser) {
          determinedRole = 'Admin';
        } else if (data.role === 'Vendor' || statusResult.hasActiveVendor) {
          determinedRole = 'Vendor';
        } else if (data.role === 'Reseller' || statusResult.hasActiveReseller) {
          determinedRole = 'Reseller';
        } else {
          determinedRole = 'Customer';
        }

        // If user is verified as Vendor or Reseller, ensure their users/{uid}.role matches
        if (determinedRole === 'Vendor' && data.role !== 'Vendor') {
          rtdbUpdate(`users/${uid}`, { role: 'Vendor', hasActiveVendor: true, updatedAt: Date.now() }).catch(() => {});
        } else if (determinedRole === 'Reseller' && data.role !== 'Reseller') {
          rtdbUpdate(`users/${uid}`, { role: 'Reseller', hasActiveReseller: true, updatedAt: Date.now() }).catch(() => {});
        }

        try {
          localStorage.setItem('rj_user_role_' + uid, determinedRole);
        } catch (_) {}

        const loaded: UserData = {
          uid: uid,
          name: data.name || 'RJ WORLD BD User',
          email: data.email || '',
          phone: data.phone ?? null,
          photo: data.photo ?? null,
          role: determinedRole,
          accountType: data.accountType || 'general',
          status: data.status || 'active',
          balance: typeof data.balance === 'number' ? data.balance : (typeof data.wallet === 'number' ? data.wallet : 0),
          wallet: typeof data.wallet === 'number' ? data.wallet : (typeof data.balance === 'number' ? data.balance : 0),
          language: data.language || 'en',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          isPremium: data.isPremium || false,
          hasActiveVendor: statusResult.hasActiveVendor,
          hasActiveReseller: statusResult.hasActiveReseller,
        };
        setUserData(loaded);
        return loaded;
      }
    } catch (error: any) {
      console.warn("Could not fetch user profile from RTDB:", error?.message || error);
    }
    return null;
  };

  const refreshUserData = async (): Promise<UserData | null> => {
    if (auth.currentUser) {
      return await fetchUserData(auth.currentUser.uid);
    }
    return null;
  };

  const handleUserAuth = async (authUser: User) => {
    try {
      let data: any = null;
      try {
        data = await rtdbGet<any>(`users/${authUser.uid}`);
      } catch (getErr: any) {
        console.warn("Could not read user profile from RTDB directly:", getErr?.message || getErr);
      }

      const userEmail = (authUser.email || '').toLowerCase();
      const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
      const isAdminUser = adminEmails.includes(userEmail) || data?.role === 'Admin';
      const statusResult = await checkAccountStatus(userEmail, authUser.uid);

      if (data) {
        // Strict role resolution: only grant Vendor or Reseller if already approved and active
        let determinedRole = 'Customer';
        if (isAdminUser) {
          determinedRole = 'Admin';
        } else if (data.role === 'Vendor' || statusResult.hasActiveVendor) {
          determinedRole = 'Vendor';
        } else if (data.role === 'Reseller' || statusResult.hasActiveReseller) {
          determinedRole = 'Reseller';
        } else {
          determinedRole = 'Customer';
        }

        // If user is verified as Vendor or Reseller, ensure their users/{uid}.role matches
        if (determinedRole === 'Vendor' && data.role !== 'Vendor') {
          rtdbUpdate(`users/${authUser.uid}`, { role: 'Vendor', hasActiveVendor: true, updatedAt: Date.now() }).catch(() => {});
        } else if (determinedRole === 'Reseller' && data.role !== 'Reseller') {
          rtdbUpdate(`users/${authUser.uid}`, { role: 'Reseller', hasActiveReseller: true, updatedAt: Date.now() }).catch(() => {});
        }

        try {
          localStorage.setItem('rj_user_role_' + authUser.uid, determinedRole);
        } catch (_) {}

        const loaded: UserData = {
          uid: authUser.uid,
          name: data.name || authUser.displayName || authUser.email?.split('@')[0] || 'RJ WORLD BD User',
          email: data.email || authUser.email || '',
          phone: data.phone ?? authUser.phoneNumber ?? null,
          photo: data.photo ?? authUser.photoURL ?? null,
          role: determinedRole,
          accountType: data.accountType || 'general',
          status: data.status || 'active',
          balance: typeof data.balance === 'number' ? data.balance : (typeof data.wallet === 'number' ? data.wallet : 0),
          wallet: typeof data.wallet === 'number' ? data.wallet : (typeof data.balance === 'number' ? data.balance : 0),
          language: data.language || 'en',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          isPremium: data.isPremium || false,
          hasActiveVendor: statusResult.hasActiveVendor,
          hasActiveReseller: statusResult.hasActiveReseller,
        };
        setUserData(loaded);
      } else {
        // Brand new user: MUST strictly be Customer (unless super admin)
        const fallbackName = authUser.displayName || authUser.email?.split('@')[0] || 'RJ WORLD BD User';
        const determinedRole = isAdminUser ? 'Admin' : 'Customer';

        try {
          localStorage.setItem('rj_user_role_' + authUser.uid, determinedRole);
        } catch (_) {}

        const initialUserData: UserData = {
          uid: authUser.uid,
          name: fallbackName,
          email: authUser.email || '',
          phone: authUser.phoneNumber || null,
          photo: authUser.photoURL || null,
          role: determinedRole,
          accountType: "general",
          status: "active",
          balance: 0,
          wallet: 0,
          language: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          hasActiveVendor: false,
          hasActiveReseller: false,
        };
        setUserData(initialUserData);

        // Attempt background persistence to Firebase Realtime Database
        try {
          await rtdbUpdate(`users/${authUser.uid}`, {
            uid: authUser.uid,
            name: fallbackName,
            email: authUser.email || '',
            phone: authUser.phoneNumber || null,
            role: determinedRole,
            accountType: "general",
            status: "active",
            balance: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } catch (rtdbWriteErr: any) {
          console.warn("RTDB user profile creation sync error:", rtdbWriteErr?.message || rtdbWriteErr);
        }

        // Auto-create referral code for user
        try {
          const userRefCode = authUser.uid.substring(0, 8).toUpperCase();
          await rtdbUpdate(`referral_codes/${authUser.uid}`, {
            code: userRefCode,
            userId: authUser.uid,
            createdAt: Date.now()
          });
        } catch (refErr) {
          console.warn('Referral code creation deferred:', refErr);
        }
      }
    } catch (error: any) {
      console.warn("Auth initialization notice:", error?.message || error);
      if (authUser) {
        const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
        const isAdm = adminEmails.includes(authUser.email?.toLowerCase() || '');
        setUserData({
          uid: authUser.uid,
          name: authUser.displayName || authUser.email?.split('@')[0] || 'RJ WORLD BD User',
          email: authUser.email || '',
          phone: authUser.phoneNumber || null,
          photo: authUser.photoURL || null,
          role: isAdm ? 'Admin' : 'user',
          status: "active",
          balance: 0,
          wallet: 0,
          language: 'en',
          createdAt: Date.now(),
        });
      }
    }
  };

  useEffect(() => {
    // Listen for foreground FCM messages
    const unsubscribeFCM = onMessageListener((payload: any) => {
      console.log('Received foreground message:', payload);
      if (payload?.notification) {
        toast(
          (t) => (
            <div className="flex gap-3 cursor-pointer" onClick={() => toast.dismiss(t.id)}>
              {payload.notification.image && (
                <img src={payload.notification.image} alt="Notification" className="w-12 h-12 rounded object-cover" />
              )}
              <div>
                <p className="font-bold text-sm text-slate-900">{payload.notification.title}</p>
                <p className="text-xs text-slate-600 mt-0.5">{payload.notification.body}</p>
              </div>
            </div>
          ),
          { duration: 6000, position: 'top-center' }
        );
      }
    });

    // Check for redirect result on load (especially on mobile devices)
    getRedirectResult(auth)
      .then(async (redirectResult) => {
        if (redirectResult?.user) {
          await handleUserAuth(redirectResult.user);
          toast.success('Successfully logged in with Google');
        }
      })
      .catch((redirectErr: any) => {
        if (redirectErr?.code && redirectErr.code !== 'auth/null-user') {
          console.warn('Redirect sign-in notice:', redirectErr);
        }
      });

    // Safety timeout to ensure loading state always resolves quickly
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    let unsubLiveUser: (() => void) | null = null;
    let unsubDeletedVendor: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      clearTimeout(safetyTimer);
      if (unsubLiveUser) {
        unsubLiveUser();
        unsubLiveUser = null;
      }
      if (unsubDeletedVendor) {
        unsubDeletedVendor();
        unsubDeletedVendor = null;
      }

      setUser(authUser);
      try {
        if (authUser) {
          await handleUserAuth(authUser);
          
          // Set up FCM for the logged-in user
          setTimeout(() => {
            requestAndSaveFCMToken(authUser.uid).catch(console.error);
          }, 2000);

          // Subscribe to real-time user profile updates (e.g. role changes from Admin)
          try {
            unsubLiveUser = rtdbSubscribe(`users/${authUser.uid}`, (liveUser) => {
              if (liveUser && typeof liveUser === 'object') {
                handleUserAuth(authUser).catch(() => {});
              }
            });
          } catch (_) {}

          // Subscribe to deleted_vendors to instantly revoke vendor role if deleted by Admin
          try {
            unsubDeletedVendor = rtdbSubscribe(`deleted_vendors/${authUser.uid}`, (delRecord) => {
              if (delRecord) {
                handleUserAuth(authUser).catch(() => {});
              }
            });
          } catch (_) {}

        } else {
          setUserData(null);
        }
      } catch (err) {
        console.warn('Auth state handler warning:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
      if (unsubLiveUser) unsubLiveUser();
      if (unsubDeletedVendor) unsubDeletedVendor();
      if (unsubscribeFCM) unsubscribeFCM();
    };
  }, []);

  const handleSocialAuthError = (error: any, providerName: string) => {
    console.warn(`${providerName} Auth Warning:`, error);
    const domain = window.location.hostname;
    const errorCode = error?.code || '';

    if (errorCode === 'auth/unauthorized-domain') {
      const notice: AuthNoticeInfo = {
        type: 'unauthorized-domain',
        provider: providerName,
        domain,
        title: `${providerName} Sign-In Domain Authorization`,
        message: `The domain "${domain}" is not listed in Firebase Authentication's Authorized Domains. To enable social logins, add "${domain}" in the Firebase Console (Authentication > Settings > Authorized domains). In the meantime, you can sign in directly using Email/Password .`
      };
      setAuthNotice(notice);
      toast.error(
        `Domain ${domain} is not authorized for ${providerName} login in Firebase. Please use Email/Password login or add this domain in Firebase Console.`,
        { duration: 6000 }
      );
    } else if (errorCode === 'auth/operation-not-allowed') {
      const notice: AuthNoticeInfo = {
        type: 'operation-not-allowed',
        provider: providerName,
        domain,
        title: `${providerName} Sign-In Not Enabled`,
        message: `${providerName} provider is currently disabled in your Firebase project. Enable ${providerName} in Firebase Console under Authentication > Sign-in method, or sign in using Email & Password.`
      };
      setAuthNotice(notice);
      toast.error(`${providerName} login is not enabled in Firebase Console. Please sign in with Email & Password.`, { duration: 5000 });
    } else if (errorCode === 'auth/popup-closed-by-user') {
      toast('Sign-in cancelled.', { icon: 'ℹ️' });
    } else if (errorCode === 'auth/popup-blocked') {
      const notice: AuthNoticeInfo = {
        type: 'popup-blocked',
        provider: providerName,
        domain,
        title: 'Popup Blocked',
        message: 'The login popup was blocked by your browser. Please allow popups for this site or use Email sign in.'
      };
      setAuthNotice(notice);
      toast.error('Popup blocked by browser. Please allow popups or use Email login.');
    } else if (errorCode === 'auth/account-exists-with-different-credential') {
      toast.error('An account already exists with this email using another login method. Please sign in with email & password.');
    } else {
      toast.error(error.message || `Failed to sign in with ${providerName}.`);
    }
  };

  const signInWithGoogle = async (): Promise<User | null> => {
    clearAuthNotice();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ 
      prompt: 'select_account' 
    });
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        await handleUserAuth(result.user);
        toast.success('Successfully logged in with Google');
        return result.user;
      }
      return null;
    } catch (error: any) {
      if (error?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider);
          return null;
        } catch (redirectErr) {
          handleSocialAuthError(redirectErr, 'Google');
          throw redirectErr;
        }
      }
      handleSocialAuthError(error, 'Google');
      throw error;
    }
  };

  const signInWithFacebook = async (): Promise<User | null> => {
    clearAuthNotice();
    const provider = new FacebookAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        await handleUserAuth(result.user);
        toast.success('Successfully logged in with Facebook');
        return result.user;
      }
      return null;
    } catch (error: any) {
      if (error?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider);
          return null;
        } catch (redirectErr) {
          handleSocialAuthError(redirectErr, 'Facebook');
          throw redirectErr;
        }
      }
      handleSocialAuthError(error, 'Facebook');
      throw error;
    }
  };


  const logout = async () => {
    try {
      if (user?.uid) {
        removeFCMToken(user.uid).catch(console.error);
      }
      await signOut(auth);
      setUserData(null);
      setUser(null);
      toast.success('Logged out successfully');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('আপনার ইমেইল এ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে, লিংক এ ঢোকে পাসওয়ার্ড নতুন করে পাসওয়ার্ড দিয়ে RJ WORLD BD তে এসে সেই নতুন পাসওয়ার্ড দিয়ে লগইন করুন');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email.');
      } else {
        toast.error(error.message || 'Failed to send reset link.');
      }
    }
  };

  const verifyEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        toast.success('Verification email sent');
      } catch (error: any) {
        toast.error(error.message || 'Failed to send verification email.');
      }
    }
  };

  const isAdmin = userData?.role === 'Admin' || user?.email?.toLowerCase() === 'riyajulhasanfahim@gmail.com' || user?.email?.toLowerCase() === 'frofficialbd1@gmail.com' || user?.email?.toLowerCase() === 'mdfahim776154@gmail.com' || false;

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        isAdmin,
        loading,
        authNotice,
        clearAuthNotice,
        signInWithGoogle,
        signInWithFacebook,
        logout,
        resetPassword,
        verifyEmail,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
