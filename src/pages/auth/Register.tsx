import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbTransaction } from '../../lib/rtdb';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, User as UserIcon, Chrome, Facebook, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthNoticeBanner from '../../components/auth/AuthNoticeBanner';
import { checkAccountStatus, getPostLoginRedirect } from '../../services/accountStatusService';
import { executeResellerWalletTransaction, isResellerAccount } from '../../services/resellerWalletService';
import { ResellerTransactionType } from '../../types/resellerWallet';

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithGoogle, signInWithFacebook, refreshUserData } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCode(refParam);
    }
  }, [searchParams]);

  const processRegistrationData = async (user: any, userEmail: string) => {
    try {
      await updateProfile(user, { displayName: name.trim() });
    } catch (authProfErr) {
      console.warn('Auth profile update notice:', authProfErr);
    }
    
    const now = Date.now();
    const cleanName = name.trim();
    const newUserData = {
      uid: user.uid,
      id: user.uid,
      name: cleanName,
      email: userEmail,
      phone: null,
      photo: null,
      role: "Customer",
      accountType: "general",
      status: "active",
      balance: 0,
      wallet: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    // Save to Firebase Realtime Database: users/{uid}
    await rtdbSet(`users/${user.uid}`, newUserData);
    
    // Save referral code in Realtime Database
    try {
      const userRefCode = user.uid.substring(0, 8).toUpperCase();
      await rtdbSet(`referral_codes/${user.uid}`, {
        code: userRefCode,
        userId: user.uid,
        createdAt: now
      });
      // Also map direct code for instant lookup
      await rtdbSet(`referral_codes/${userRefCode}`, {
        code: userRefCode,
        userId: user.uid,
        createdAt: now
      });
    } catch (refErr) {
      console.warn('Referral code creation notice:', refErr);
    }

    // Process referral sponsor if provided
    if (referralCode.trim()) {
      try {
        let sponsorId = '';
        const cleanRef = referralCode.trim().toUpperCase();
        
        // 1. Direct code lookup in RTDB
        const directCode = await rtdbGet<any>(`referral_codes/${cleanRef}`);
        if (directCode && directCode.userId) {
          sponsorId = directCode.userId;
        }

        // 2. Search all referral codes in RTDB
        if (!sponsorId) {
          const allRefCodes = await rtdbGet<Record<string, any>>('referral_codes');
          if (allRefCodes && typeof allRefCodes === 'object') {
            for (const [key, val] of Object.entries(allRefCodes)) {
              if (val && (val.code === cleanRef || String(key).toUpperCase() === cleanRef)) {
                sponsorId = val.userId || key;
                break;
              }
            }
          }
        }

        // 3. Search MLM members in RTDB
        if (!sponsorId) {
          const mlmMembers = await rtdbGet<Record<string, any>>('mlm_members');
          if (mlmMembers && typeof mlmMembers === 'object') {
            for (const [key, val] of Object.entries(mlmMembers)) {
              if (val && (val.id === cleanRef || String(key).toUpperCase() === cleanRef)) {
                sponsorId = val.id || key;
                break;
              }
            }
          }
        }

        // 4. Search users in RTDB
        if (!sponsorId) {
          const allUsers = await rtdbGet<Record<string, any>>('users');
          if (allUsers && typeof allUsers === 'object') {
            for (const [key, val] of Object.entries(allUsers)) {
              if (key.toUpperCase().startsWith(cleanRef) || val?.uid?.toUpperCase()?.startsWith(cleanRef)) {
                sponsorId = val?.uid || key;
                break;
              }
            }
          }
        }

        if (sponsorId) {
          // Link sponsor in user record
          await rtdbUpdate(`users/${user.uid}`, {
            sponsorId: sponsorId,
            referredBy: sponsorId,
            referralCodeUsed: cleanRef,
            isMLMMember: true
          });

          // Save MLM membership in RTDB
          await rtdbSet(`mlm_members/${user.uid}`, {
            id: user.uid,
            name: cleanName,
            sponsorId: sponsorId,
            parentId: sponsorId,
            level: 1,
            status: 'Active',
            joinDate: now,
            personalSales: 0,
            teamSales: 0,
            rank: 'Starter'
          });

          // Distribute commissions in RTDB
          try {
            const addCommission = async (beneficiaryId: string, amount: number, levelDesc: string) => {
              if (!beneficiaryId) return;
              
              const isResellerUser = await isResellerAccount(beneficiaryId);
              if (!isResellerUser) return;

              await rtdbPush('reseller_transactions', {
                resellerId: beneficiaryId,
                orderId: 'INVITE-' + user.uid,
                customerName: cleanName,
                productName: 'Friend Invite Commission (' + levelDesc + ')',
                amount: amount,
                status: 'Approved',
                createdAt: now,
                isReferral: true
              });
              
              await executeResellerWalletTransaction({
                resellerId: beneficiaryId,
                userId: beneficiaryId,
                orderId: 'INVITE-' + user.uid,
                amount,
                type: ResellerTransactionType.PROFIT_RELEASED,
                status: 'Approved',
                description: `Friend Invite Commission (${levelDesc})`,
                metadata: {
                  customerName: cleanName,
                  levelDesc
                }
              });

              await rtdbTransaction(`reseller_wallet/${beneficiaryId}`, (curr) => {
                if (!curr) return curr;
                return {
                  ...curr,
                  teamMembers: Number(curr.teamMembers || 0) + 1,
                  updatedAt: now
                };
              });
            };

            const l1Member = await rtdbGet<any>(`mlm_members/${sponsorId}`);
            if (l1Member) {
              await addCommission(sponsorId, 150, 'Level 1');
              if (l1Member.sponsorId) {
                const l2Member = await rtdbGet<any>(`mlm_members/${l1Member.sponsorId}`);
                if (l2Member) {
                  await addCommission(l1Member.sponsorId, 100, 'Level 2');
                  if (l2Member.sponsorId) {
                    await addCommission(l2Member.sponsorId, 50, 'Level 3');
                  }
                }
              }
            } else {
              await addCommission(sponsorId, 150, 'Direct Referral');
            }
          } catch (commErr) {
            console.error('Commission distribution failed:', commErr);
          }
          
          // Bonus for the new user for using referral code in RTDB
          try {
            await rtdbSet(`user_wallet/${user.uid}`, {
              walletBalance: 0,
              pendingCommission: 0,
              approvedCommission: 0,
              totalSales: 0,
              totalOrders: 0,
              createdAt: now,
              updatedAt: now,
              lockedBonus: 50,
              bonusEligibleSales: 0,
              bonusClaimed: false
            });
          } catch (bonusErr) {
            console.error('Bonus distribution failed:', bonusErr);
          }
        }
      } catch (sponsorErr) {
        console.warn('Sponsor linking notice:', sponsorErr);
      }
    }
    
    const freshUser = await refreshUserData();
    toast.success('Account created successfully! Welcome to RJ WORLD BD.');
    const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
    const isUserAdmin = freshUser?.role === 'Admin' || adminEmails.includes(userEmail.toLowerCase());
    if (isUserAdmin) {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password || !confirmPassword) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await processRegistrationData(userCredential.user, email.trim());
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (error: any) => {
    console.error('Registration Error:', error);
    const code = error?.code || '';
    if (code === 'auth/email-already-in-use') {
      toast.error('An account already exists with this email. Please sign in instead.');
    } else if (code === 'auth/invalid-email') {
      toast.error('Please enter a valid email address.');
    } else if (code === 'auth/weak-password') {
      toast.error('Password is too weak. Please use at least 6 characters.');
    } else if (code === 'auth/operation-not-allowed') {
      toast.error('Email authentication is not enabled in Firebase Console.');
    } else if (error?.message?.includes('network-request-failed') || code === 'auth/network-request-failed') {
      toast.error('Network error. Please check your internet connection.');
    } else {
      toast.error(error.message || 'Registration failed. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        const uData = await refreshUserData();
        const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
        const isUserAdmin = uData?.role === 'Admin' || adminEmails.includes(loggedUser.email?.toLowerCase() || '');
        if (isUserAdmin) {
          navigate('/admin/dashboard', { replace: true });
        } else if (uData?.role === 'Vendor') {
          navigate('/vendor-dashboard', { replace: true });
        } else if (uData?.role === 'Reseller') {
          navigate('/reseller/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch {
      // error handled in context
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      const loggedUser = await signInWithFacebook();
      if (loggedUser) {
        const uData = await refreshUserData();
        const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
        const isUserAdmin = uData?.role === 'Admin' || adminEmails.includes(loggedUser.email?.toLowerCase() || '');
        if (isUserAdmin) {
          navigate('/admin/dashboard', { replace: true });
        } else if (uData?.role === 'Vendor') {
          navigate('/vendor-dashboard', { replace: true });
        } else if (uData?.role === 'Reseller') {
          navigate('/reseller/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch {
      // error handled in context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50/20 to-slate-100 p-4 sm:p-6 md:p-8 font-sans py-8 sm:py-12 md:py-16">
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/60 p-5 sm:p-8 md:p-10 space-y-5 border border-slate-100">
        <div className="text-center">
          <Link to="/" className="inline-block mb-2 group">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 group-hover:opacity-90 transition-opacity">
              RJ <span className="text-primary-main">WORLD BD</span>
            </span>
          </Link>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">Create Account</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Join RJ WORLD BD & enjoy shopping</p>
        </div>

        <AuthNoticeBanner />

        <form onSubmit={handleRegister} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                placeholder="Your name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              Email Address *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 sm:pl-11 pr-10 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                  placeholder="Min 6 chars"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 sm:pl-11 pr-10 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                  placeholder="Repeat pass"
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 sm:py-3.5 px-4 rounded-xl shadow-md text-sm sm:text-base font-bold text-white bg-primary-main hover:bg-sky-600 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer mt-2"
          >
            {loading ? 'Processing...' : 'Create Account'}
            {!loading && <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-slate-400 font-medium">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full inline-flex justify-center items-center py-2.5 sm:py-3 px-3 border border-slate-200 rounded-xl shadow-2xs bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            <Chrome className="h-4 w-4 text-red-500 mr-2 shrink-0" />
            Google
          </button>
          <button
            type="button"
            onClick={handleFacebookSignIn}
            className="w-full inline-flex justify-center items-center py-2.5 sm:py-3 px-3 border border-slate-200 rounded-xl shadow-2xs bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            <Facebook className="h-4 w-4 text-blue-600 mr-2 shrink-0" />
            Facebook
          </button>
        </div>

        <p className="text-center text-xs sm:text-sm text-slate-600 pt-3 border-t border-slate-100">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-primary-main hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
