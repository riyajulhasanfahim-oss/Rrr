import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush } from '../lib/rtdb';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { Check, ChevronRight, ChevronDown, User, Users, MapPin, Mail, Phone, Store, CheckCircle, ArrowLeft, Lock, FileText, Gift, MessageCircle, Eye, EyeOff, Copy, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { DriveImageUpload } from '../components/common/DriveImageUpload';
import PaymentMethodSelectionModal from '../components/checkout/PaymentMethodSelectionModal';
import BkashPaymentModal from '../components/checkout/BkashPaymentModal';
import NagadPaymentModal from '../components/checkout/NagadPaymentModal';
import RocketPaymentModal from '../components/checkout/RocketPaymentModal';
import UpayPaymentModal from '../components/checkout/UpayPaymentModal';
import { verifyPaymentAutomatic, type VerificationResult } from '../services/automaticPaymentVerificationService';
import { checkAccountStatus } from '../services/accountStatusService';
import { lookupReferralCode, creditReferralBonus, getOrCreateReferralCode } from '../services/resellerReferralService';

export default function ResellerApplication() {
  const { user, userData, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    whatsappNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    address: '',
    inviteCode: ''
  });

  const [paymentMethod, setPaymentMethod] = useState<'bKash' | 'Nagad' | 'Rocket' | 'Upay' | ''>('bKash');
  const [transactionId, setTransactionId] = useState('');
  const [promoBonus, setPromoBonus] = useState(0);
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [referralSponsor, setReferralSponsor] = useState<{ userId: string; name: string; code: string } | null>(null);
  const [referralFeedback, setReferralFeedback] = useState<string>('');

  // Auto-populate referral code from URL query params (e.g. ?ref=CODE or ?code=CODE)
  useEffect(() => {
    const refParam = searchParams.get('ref') || searchParams.get('code') || searchParams.get('invite');
    if (refParam) {
      setFormData(prev => ({ ...prev, inviteCode: refParam.trim().toUpperCase() }));
    }
  }, [searchParams]);

  // New Payment System States (matching Vendor Registration & Checkout)
  const [showPaymentSelectionModal, setShowPaymentSelectionModal] = useState<boolean>(false);
  const [showBkashModal, setShowBkashModal] = useState<boolean>(false);
  const [showNagadModal, setShowNagadModal] = useState<boolean>(false);
  const [showRocketModal, setShowRocketModal] = useState<boolean>(false);
  const [showUpayModal, setShowUpayModal] = useState<boolean>(false);
  const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<'bkash' | 'nagad' | 'rocket' | 'upay' | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string>('');
  const [registrationFeeAmount, setRegistrationFeeAmount] = useState<number>(390);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string>(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let inv = 'S2N';
    for (let i = 0; i < 9; i++) {
      inv += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return inv;
  });

  // Fetch dynamic reseller registration fee from Realtime Database if configured
  useEffect(() => {
    const fetchFee = async () => {
      try {
        const resellerSettings = await rtdbGet('settings/reseller');
        if (resellerSettings && resellerSettings.registrationFee !== undefined) {
          const fee = Number(resellerSettings.registrationFee);
          if (!isNaN(fee) && fee > 0) {
            setRegistrationFeeAmount(fee);
            return;
          }
        }
        const appConfig = await rtdbGet('settings/appConfig');
        if (appConfig && appConfig.resellerRegistrationFee !== undefined) {
          const fee = Number(appConfig.resellerRegistrationFee);
          if (!isNaN(fee) && fee > 0) {
            setRegistrationFeeAmount(fee);
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching dynamic reseller registration fee:', err);
      }
    };
    fetchFee();
  }, []);

  useEffect(() => {
    if (userData?.role === 'Reseller' || userData?.hasActiveReseller) {
      navigate('/reseller/dashboard', { replace: true });
      return;
    }
    
    if (user) {
      checkAccountStatus(user.email, user.uid).then(status => {
        if (status.hasActiveReseller) {
          navigate('/reseller/dashboard', { replace: true });
          return;
        }
      }).catch(err => {
        console.warn("Could not check reseller status:", err);
      });
    }

    if (user) {
      setFormData(prev => ({
        ...prev,
        email: prev.email || user.email || '',
        fullName: prev.fullName || user.displayName || userData?.name || '',
        mobileNumber: prev.mobileNumber || userData?.phone || ''
      }));
    }
  }, [user, userData, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const checkInviteCode = async () => {
      const code = formData.inviteCode.trim().toUpperCase();
      if (!code) {
        setPromoValid(null);
        setPromoBonus(0);
        setReferralSponsor(null);
        setReferralFeedback('');
        return;
      }
      
      if (code.length >= 3) {
        try {
          // 1. First check if it's a valid Reseller Referral Code
          const refResult = await lookupReferralCode(code);
          if (refResult.valid && refResult.userId) {
            setReferralSponsor({
              userId: refResult.userId,
              name: refResult.name || 'রেফারার পার্টনার',
              code: refResult.code || code
            });
            setPromoBonus(50);
            setPromoValid(true);
            setReferralFeedback(`সঠিক রেফারেল কোড (${refResult.name || 'রেফারার'})! অ্যাকাউন্ট খোলার সাথে সাথেই ওয়ালেটে ৫০ টাকা বোনাস যোগ হবে।`);
            return;
          }

          // 2. Otherwise check if it is a general promo code (e.g. WELCOME50)
          const promoData = await rtdbGet<any>('promo_codes/' + code);
          if (promoData || code === 'WELCOME50') {
            let isValid = true;
            if (promoData) {
              if (promoData.status === 'inactive' || (promoData.usageLimit && promoData.usedCount >= promoData.usageLimit)) {
                isValid = false;
              }
            }
            if (isValid) {
              setReferralSponsor(null);
              setPromoBonus(50);
              setPromoValid(true);
              setReferralFeedback('প্রোমো কোড সফলভাবে যুক্ত হয়েছে! ৳৫০ বোনাস প্রযোজ্য।');
            } else {
              setReferralSponsor(null);
              setPromoBonus(0);
              setPromoValid(false);
              setReferralFeedback('প্রোমো কোডের মেয়াদ উত্তীর্ণ বা নিষ্ক্রিয়।');
            }
          } else {
            setReferralSponsor(null);
            setPromoBonus(0);
            setPromoValid(false);
            setReferralFeedback('ভুল রেফারেল কোড। অনুগ্রহ করে সঠিক কোড দিন।');
          }
        } catch (error) {
          console.error('[ResellerApplication] Error validating code:', error);
          setReferralSponsor(null);
          setPromoBonus(0);
          setPromoValid(false);
          setReferralFeedback('রেফারেল কোড যাচাই করতে সমস্যা হয়েছে।');
        }
      } else {
        setPromoValid(null);
        setPromoBonus(0);
        setReferralSponsor(null);
        setReferralFeedback('');
      }
    };

    const debounceTimer = setTimeout(checkInviteCode, 400);
    return () => clearTimeout(debounceTimer);
  }, [formData.inviteCode]);

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.mobileNumber.trim() || !formData.address.trim() || !formData.email.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    
    if (!formData.password) {
      toast.error('Please enter a password');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!currentInvoiceId) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let inv = 'S2N';
      for (let i = 0; i < 9; i++) {
        inv += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setCurrentInvoiceId(inv);
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCompletePaymentAndRegistration = async (
    channel: 'bkash' | 'nagad' | 'rocket' | 'upay',
    trxId: string
  ) => {
    if (!trxId.trim()) {
      toast.error('Transaction ID (TrxID) লিখুন');
      return;
    }

    setLoading(true);
    try {
      let currentUserId = user?.uid;

      if (!currentUserId) {
        try {
          // Create new user account via Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password);
          currentUserId = userCredential.user.uid;
        } catch (authErr: any) {
          if (authErr?.code === 'auth/email-already-in-use') {
            try {
              const signinCred = await signInWithEmailAndPassword(auth, formData.email.trim(), formData.password);
              currentUserId = signinCred.user.uid;
            } catch {
              toast.error('Email is already registered. Please enter the correct password or login first.');
              setLoading(false);
              return;
            }
          } else {
            throw authErr;
          }
        }
      }

      if (currentUserId && auth.currentUser && formData.password) {
        try {
          await updatePassword(auth.currentUser, formData.password);
        } catch (pwErr) {
          console.warn('Note: Could not update password for existing session directly:', pwErr);
        }
      }

      const formattedMethod = 
        channel === 'bkash' ? 'bKash' : 
        channel === 'nagad' ? 'Nagad' : 
        channel === 'rocket' ? 'Rocket' : 'Upay';

      setPaymentMethod(formattedMethod);
      setTransactionId(trxId.trim().toUpperCase());

      // Call Automatic Payment Verification with 8-second safety timeout
      const timeoutPromise = new Promise<VerificationResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Payment verification timed out. Please try again.'));
        }, 8000);
      });

      const result = await Promise.race([
        verifyPaymentAutomatic({
          transactionId: trxId.trim().toUpperCase(),
          paymentMethod: channel,
          expectedAmount: registrationFeeAmount,
          invoiceId: currentInvoiceId,
          userId: currentUserId,
          userType: 'reseller',
          contextData: {
            fullName: formData.fullName.trim(),
            mobileNumber: formData.mobileNumber.trim()
          }
        }),
        timeoutPromise
      ]);

      if (result.status === 'verified') {
        const resellerPayload = {
          userId: currentUserId,
          resellerId: currentUserId,
          fullName: formData.fullName.trim(),
          mobileNumber: formData.mobileNumber.trim(),
          whatsappNumber: formData.whatsappNumber.trim() || formData.mobileNumber.trim(),
          email: formData.email.trim() || user?.email || '',
          address: formData.address.trim(),
          status: 'approved',
          appliedPromoCode: promoValid ? formData.inviteCode.trim().toUpperCase() : null,
          referredBy: referralSponsor?.userId || null,
          referralCodeUsed: referralSponsor?.code || (promoValid ? formData.inviteCode.trim().toUpperCase() : null),
          totalSales: 0,
          rank: 'Beginner',
          registrationFee: registrationFeeAmount,
          registrationPayment: 'completed',
          paymentMethod: formattedMethod,
          transactionId: trxId.trim().toUpperCase(),
          invoiceId: currentInvoiceId,
          verifiedAt: result.verifiedAt || Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const initialBonus = promoValid ? (promoBonus > 0 ? promoBonus : 50) : 0;
        const walletPayload = {
          resellerId: currentUserId,
          availableBalance: initialBonus,
          lockedBalance: 0,
          totalBalance: initialBonus,
          pendingProfit: 0,
          releasedProfit: initialBonus,
          cancelledProfit: 0,
          walletBalance: initialBonus,
          pendingCommission: 0,
          approvedCommission: initialBonus,
          lifetimeCommission: initialBonus,
          totalSales: 0,
          totalOrders: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        try {
          localStorage.setItem('rj_active_reseller_' + currentUserId, JSON.stringify(resellerPayload));
          localStorage.setItem('rj_has_active_reseller_' + currentUserId, 'true');
          localStorage.setItem('rj_user_role_' + currentUserId, 'Reseller');
        } catch (_) {}

        await Promise.allSettled([
          rtdbUpdate(`resellers/${currentUserId}`, resellerPayload),
          rtdbUpdate(`reseller_wallet/${currentUserId}`, walletPayload),
          rtdbUpdate(`users/${currentUserId}`, {
            name: formData.fullName.trim(),
            email: formData.email.trim() || user?.email || '',
            phone: formData.mobileNumber.trim(),
            role: 'Reseller',
            walletBalance: initialBonus,
            resellerBalance: initialBonus,
            referredBy: referralSponsor?.userId || null,
            referralCodeUsed: referralSponsor?.code || null,
            updatedAt: Date.now()
          })
        ]);

        // If referral code bonus was applied, record in reseller transactions and ledger
        if (initialBonus > 0) {
          const now = Date.now();
          const bonusTxId = `TXN-REF-BONUS-${currentUserId.substring(0, 6)}-${now}`;
          await Promise.allSettled([
            rtdbSet(`reseller_wallet_transactions/${bonusTxId}`, {
              transactionId: bonusTxId,
              userId: currentUserId,
              resellerId: currentUserId,
              orderId: `BONUS-${currentUserId.substring(0, 8)}`,
              amount: initialBonus,
              type: 'PROFIT_RELEASED',
              status: 'COMPLETED',
              balanceBefore: { availableBalance: 0, lockedBalance: 0, totalBalance: 0 },
              balanceAfter: { availableBalance: initialBonus, lockedBalance: 0, totalBalance: initialBonus },
              description: `রেফারেল কোড বোনাস (৳${initialBonus})`,
              idempotencyKey: `signup_ref_bonus_${currentUserId}`,
              metadata: {
                bonusType: 'reseller_referral_signup',
                referralCodeUsed: referralSponsor?.code || formData.inviteCode.trim().toUpperCase()
              },
              createdAt: now,
              updatedAt: now
            }),
            rtdbPush('reseller_transactions', {
              resellerId: currentUserId,
              orderId: `BONUS-${currentUserId.substring(0, 8)}`,
              customerName: formData.fullName.trim(),
              productName: 'রেফারেল বোনাস (অ্যাকাউন্ট খোলার পুরষ্কার)',
              amount: initialBonus,
              status: 'Approved',
              createdAt: now,
              isReferral: true
            })
          ]);
        }

        // Credit referral bonus to the referrer's reseller wallet
        if (referralSponsor && referralSponsor.userId) {
          try {
            await creditReferralBonus(
              referralSponsor.userId,
              currentUserId,
              formData.fullName.trim(),
              formData.email.trim() || user?.email || ''
            );
          } catch (refErr) {
            console.error('[ResellerApplication] Error crediting referral bonus:', refErr);
          }
        }

        // Pre-create the newly registered reseller's own referral code
        await getOrCreateReferralCode(currentUserId, formData.fullName.trim()).catch(() => {});

        if (refreshUserData) {
          await refreshUserData().catch(() => {});
        }

        setShowBkashModal(false);
        setShowNagadModal(false);
        setShowRocketModal(false);
        setShowUpayModal(false);
        setShowPaymentSelectionModal(false);
        setLoading(false);

        toast.success(initialBonus > 0 ? 'পেমেন্ট সফলভাবে যাচাই হয়েছে! রেফারেল বোনাস ৫০ টাকা আপনার ওয়ালেটে যোগ হয়েছে।' : 'পেমেন্ট সফলভাবে যাচাই হয়েছে! রিসেলার ড্যাশবোর্ডে স্বাগতম।');
        navigate('/reseller/dashboard', { replace: true });
        return;
      } else {
        setLoading(false);
        let errorMsg = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
        if (result.rejectionReason === 'amount_mismatch') {
          errorMsg = result.message || `পেমেন্ট এমাউন্ট সঠিক নয়! প্রত্যাশিত: ৳${registrationFeeAmount.toFixed(2)}।`;
        } else if (result.rejectionReason === 'method_mismatch') {
          errorMsg = result.message || 'পেমেন্ট মেথড সঠিক নয়! সঠিক পেমেন্ট মেথড ব্যবহার করুন।';
        } else if (result.rejectionReason === 'duplicate_transaction') {
          errorMsg = result.message || 'এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহৃত হয়েছে!';
        } else if (result.message) {
          errorMsg = result.message;
        }
        setPaymentErrorMessage(errorMsg);
        toast.error(errorMsg, { duration: 6000 });
      }
    } catch (error: any) {
      console.error('Error registering reseller:', error);
      let errNotice = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
      if (error.code === 'auth/email-already-in-use') {
        errNotice = 'Email is already registered. Please login to apply as reseller.';
      }
      setPaymentErrorMessage(errNotice);
      toast.error(errNotice, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      
      <main className="flex-grow pt-4 sm:pt-6 md:pt-10 pb-12 sm:pb-16 md:pb-24 px-3 sm:px-6 md:px-8 lg:px-12">
        <div className="w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto transition-all">
          
          {/* Top Step & Navigation Bar */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 sm:pb-4 mb-4 sm:mb-6">
            <button 
              type="button" 
              onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} 
              className="inline-flex items-center text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
              {step > 1 ? 'Back' : 'Home'}
            </button>
            
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-primary-main ring-4 ring-primary-main/20' : 'bg-green-500'}`}></span>
              <span className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-primary-main ring-4 ring-primary-main/20' : 'bg-slate-200'}`}></span>
              <span className="text-xs sm:text-sm font-bold text-slate-600 ml-1.5">
                Step {step} of 2
              </span>
            </div>
          </div>

          <div className="text-center mb-5 sm:mb-8">
            <div className="w-10 h-10 sm:w-13 sm:h-13 bg-slate-900 text-white rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2.5 shadow-md">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
              {step === 1 ? 'Become a Reseller' : 'Reseller Registration Fee'}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-500 mt-1 max-w-lg mx-auto">
              {step === 1 ? 'Start your business journey today and earn commissions' : `Send ৳${registrationFeeAmount} registration fee to activate reseller account`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-sm sm:shadow-lg border border-slate-200/80 p-4 sm:p-7 md:p-9"
              >
                <form onSubmit={handleProceedToPayment} className="space-y-4 sm:space-y-6">
                  {/* Personal Info */}
                  <div className="space-y-3 sm:space-y-4 md:space-y-5">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                      Personal & Contact Information
                    </h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                      <div>
                        <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Full Name *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
                            <User className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                          </div>
                          <input
                            type="text"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            required
                            className="pl-9 sm:pl-10 md:pl-11 w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="Full Name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Email Address *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                          </div>
                          <input
                            type="email"
                            name="email"
                            inputMode="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="pl-9 sm:pl-10 md:pl-11 w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="reseller@example.com"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                      <div>
                        <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Mobile Number *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
                            <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                          </div>
                          <input
                            type="tel"
                            name="mobileNumber"
                            inputMode="tel"
                            value={formData.mobileNumber}
                            onChange={handleChange}
                            required
                            className="pl-9 sm:pl-10 md:pl-11 w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="01XXXXXXXXX"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                          WhatsApp Number (Optional)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
                            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                          </div>
                          <input
                            type="tel"
                            name="whatsappNumber"
                            inputMode="tel"
                            value={formData.whatsappNumber}
                            onChange={handleChange}
                            className="pl-9 sm:pl-10 md:pl-11 w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="01XXXXXXXXX"
                          />
                        </div>
                      </div>
                    </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                        <div>
                          <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                            Password *
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
                              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                            </div>
                            <input
                              type={showPassword ? "text" : "password"}
                              name="password"
                              value={formData.password}
                              onChange={handleChange}
                              required
                              className="pl-9 sm:pl-10 md:pl-11 pr-10 w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                            Confirm Password *
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
                              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                            </div>
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              name="confirmPassword"
                              value={formData.confirmPassword}
                              onChange={handleChange}
                              required
                              className="pl-9 sm:pl-10 md:pl-11 pr-10 w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                    <div>
                      <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                        Full Address *
                      </label>
                      <div className="relative">
                        <div className="absolute top-3 left-3 sm:left-3.5 flex items-start pointer-events-none">
                          <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                        </div>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          required
                          rows={2}
                          className="pl-9 sm:pl-10 md:pl-11 w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all resize-none placeholder:text-slate-400"
                          placeholder="Street, City, District"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Referral / Invite Code */}
                  <div className="space-y-2 pt-2 sm:pt-4 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider">
                        রেফারেল কোড / Referral Code (ঐচ্ছিক)
                      </label>
                      <span className="text-xs text-primary-main font-semibold">রেফারেল কোড দিলে ৫০ টাকা বোনাস ওয়ালেটে পাবেন</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
                          <Gift className={`h-4 w-4 sm:h-5 sm:w-5 ${promoValid ? 'text-emerald-500' : promoValid === false ? 'text-rose-500' : 'text-slate-400'}`} />
                        </div>
                        <input
                          type="text"
                          name="inviteCode"
                          value={formData.inviteCode}
                          onChange={handleChange}
                          disabled={promoValid === true}
                          className={`pl-9 sm:pl-10 md:pl-11 w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base bg-slate-50 border rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all uppercase tracking-wider font-mono disabled:opacity-80 ${promoValid ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold' : promoValid === false ? 'border-rose-400 bg-rose-50/50 text-rose-900' : 'border-slate-200'}`}
                          placeholder="রেফারেল কোড লিখুন (যেমন: A1B2C3D4)"
                        />
                        {promoValid === true && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          </div>
                        )}
                      </div>
                      {promoValid === true && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, inviteCode: '' }));
                            setPromoValid(null);
                            setPromoBonus(0);
                            setReferralSponsor(null);
                            setReferralFeedback('');
                          }}
                          className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                          মুছুন
                        </button>
                      )}
                    </div>
                    {promoValid === true && (
                      <p className="text-xs sm:text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>{referralFeedback || 'সঠিক রেফারেল কোড! একাউন্ট খোলার সাথে সাথেই ওয়ালেটে ৫০ টাকা বোনাস চলে যাবে।'}</span>
                      </p>
                    )}
                    {promoValid === false && formData.inviteCode.length >= 3 && (
                      <p className="text-xs sm:text-sm font-semibold text-rose-500 flex items-center gap-1.5">
                        <span>{referralFeedback || 'ভুল বা মেয়াদোত্তীর্ণ রেফারেল কোড। অনুগ্রহ করে সঠিক কোড দিন।'}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-3 sm:pt-4">
                    <button
                      type="submit"
                      className="w-full h-11 sm:h-12 md:h-13 bg-primary-main hover:bg-sky-600 active:bg-sky-700 text-white text-xs sm:text-sm md:text-base font-bold rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-primary-main/25 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      Continue to Payment <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>

                  <div className="text-center text-xs sm:text-sm text-slate-500 pt-1">
                    Already registered?{' '}
                    <Link to="/reseller-login" className="font-bold text-primary-main hover:underline">
                      Login
                    </Link>
                  </div>
                </form>
              </motion.div>
            )}

            {/* STEP 2: Registration Fee Payment Summary & Action */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 md:p-9 shadow-sm sm:shadow-lg border border-slate-200/80 space-y-4 sm:space-y-5 md:space-y-6"
              >
                {/* Fee badge */}
                <div className="bg-blue-50/80 border border-blue-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-700">
                    One-time Registration Fee
                  </div>
                  <div className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-tight mt-1.5">৳{registrationFeeAmount}</div>
                  <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1.5">
                    রিসেলার অ্যাকাউন্ট অ্যাক্টিভেশনের জন্য ওয়ান-টাইম রেজিস্ট্রেশন ফি প্রদান করুন
                  </p>
                </div>

                {/* Reseller Application Summary */}
                <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200/70 text-left text-xs sm:text-sm md:text-base space-y-2.5 sm:space-y-3.5">
                  <div className="flex justify-between items-center text-xs sm:text-sm md:text-base border-b border-slate-200/60 pb-2 sm:pb-2.5">
                    <span className="text-slate-500">Applicant Name:</span>
                    <span className="font-bold text-slate-800">{formData.fullName || 'Reseller'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm md:text-base border-b border-slate-200/60 pb-2 sm:pb-2.5">
                    <span className="text-slate-500">Mobile Number:</span>
                    <span className="font-bold text-slate-800">{formData.mobileNumber}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm md:text-base border-b border-slate-200/60 pb-2 sm:pb-2.5">
                    <span className="text-slate-500">Email Address:</span>
                    <span className="font-bold text-slate-800">{formData.email}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm md:text-base">
                    <span className="text-slate-500">Invoice ID:</span>
                    <span className="font-bold text-slate-800 tracking-wide">{currentInvoiceId}</span>
                  </div>
                  {promoValid && (
                    <div className="flex justify-between items-center text-xs sm:text-sm md:text-base pt-2 border-t border-slate-200/60 text-emerald-600 font-bold">
                      <span className="flex items-center gap-1.5"><Gift className="w-4 h-4 text-emerald-500" /> রেফারেল বোনাস:</span>
                      <span>+৳৫০ (ওয়ালেটে জমা হবে)</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 sm:gap-4 pt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowPaymentSelectionModal(false);
                      setStep(1);
                    }} 
                    className="w-1/3 h-11 sm:h-12 md:h-13 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl sm:rounded-2xl text-xs sm:text-sm md:text-base transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowPaymentSelectionModal(true)}
                    className="w-2/3 h-11 sm:h-12 md:h-13 bg-primary-main hover:bg-sky-600 active:bg-sky-700 text-white font-bold rounded-xl sm:rounded-2xl text-xs sm:text-sm md:text-base shadow-md shadow-primary-main/25 transition-all flex justify-center items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    Pay ৳{registrationFeeAmount}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1. Payment Method Selection Modal */}
          <PaymentMethodSelectionModal
            isOpen={showPaymentSelectionModal}
            onClose={() => setShowPaymentSelectionModal(false)}
            amount={registrationFeeAmount}
            paymentType="reseller_registration_fee"
            invoiceId={currentInvoiceId}
            isSubmitting={loading}
            selectedChannel={selectedPaymentChannel}
            onSelectChannel={setSelectedPaymentChannel}
            onConfirmPayment={(channel) => {
              setPaymentErrorMessage('');
              setShowPaymentSelectionModal(false);
              if (channel === 'bkash') {
                setShowBkashModal(true);
              } else if (channel === 'nagad') {
                setShowNagadModal(true);
              } else if (channel === 'rocket') {
                setShowRocketModal(true);
              } else if (channel === 'upay') {
                setShowUpayModal(true);
              }
            }}
          />

          {/* 2. bKash Payment Instruction Modal */}
          <BkashPaymentModal
            isOpen={showBkashModal}
            onClose={() => {
              setShowBkashModal(false);
              setPaymentErrorMessage('');
            }}
            onBack={() => {
              setShowBkashModal(false);
              setPaymentErrorMessage('');
              setShowPaymentSelectionModal(true);
            }}
            amount={registrationFeeAmount}
            invoiceId={currentInvoiceId}
            bkashNumber="01864670673"
            isSubmitting={loading}
            errorMessage={paymentErrorMessage}
            onVerify={(trxId) => {
              handleCompletePaymentAndRegistration('bkash', trxId);
            }}
          />

          {/* 3. Nagad Payment Instruction Modal */}
          <NagadPaymentModal
            isOpen={showNagadModal}
            onClose={() => {
              setShowNagadModal(false);
              setPaymentErrorMessage('');
            }}
            onBack={() => {
              setShowNagadModal(false);
              setPaymentErrorMessage('');
              setShowPaymentSelectionModal(true);
            }}
            amount={registrationFeeAmount}
            invoiceId={currentInvoiceId}
            nagadNumber="01864670673"
            isSubmitting={loading}
            errorMessage={paymentErrorMessage}
            onVerify={(trxId) => {
              handleCompletePaymentAndRegistration('nagad', trxId);
            }}
          />

          {/* 4. Rocket Payment Instruction Modal */}
          <RocketPaymentModal
            isOpen={showRocketModal}
            onClose={() => {
              setShowRocketModal(false);
              setPaymentErrorMessage('');
            }}
            onBack={() => {
              setShowRocketModal(false);
              setPaymentErrorMessage('');
              setShowPaymentSelectionModal(true);
            }}
            amount={registrationFeeAmount}
            invoiceId={currentInvoiceId}
            rocketNumber="01864670673"
            isSubmitting={loading}
            errorMessage={paymentErrorMessage}
            onVerify={(trxId) => {
              handleCompletePaymentAndRegistration('rocket', trxId);
            }}
          />

          {/* 5. Upay Payment Instruction Modal */}
          <UpayPaymentModal
            isOpen={showUpayModal}
            onClose={() => {
              setShowUpayModal(false);
              setPaymentErrorMessage('');
            }}
            onBack={() => {
              setShowUpayModal(false);
              setPaymentErrorMessage('');
              setShowPaymentSelectionModal(true);
            }}
            amount={registrationFeeAmount}
            invoiceId={currentInvoiceId}
            upayNumber="01864670673"
            isSubmitting={loading}
            errorMessage={paymentErrorMessage}
            onVerify={(trxId) => {
              handleCompletePaymentAndRegistration('upay', trxId);
            }}
          />

          {step === 1 && (
            <div className="mt-6 text-center text-sm text-slate-500">
              Already a reseller?{' '}
              <button onClick={() => navigate('/login')} className="font-bold text-primary-main hover:underline">
                Login here
              </button>
            </div>
          )}
        </div>
      </main>
      
    </div>
  );
}
