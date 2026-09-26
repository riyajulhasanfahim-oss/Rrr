import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { auth } from '../../../lib/firebase';
import { rtdbGet, rtdbSet, rtdbUpdate } from '../../../lib/rtdb';
import { 
  Store, ChevronRight, CheckCircle, ArrowLeft, Eye, EyeOff, Copy, Check, 
  ShieldCheck, Phone 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import PaymentMethodSelectionModal from '../../../components/checkout/PaymentMethodSelectionModal';
import BkashPaymentModal from '../../../components/checkout/BkashPaymentModal';
import NagadPaymentModal from '../../../components/checkout/NagadPaymentModal';
import RocketPaymentModal from '../../../components/checkout/RocketPaymentModal';
import UpayPaymentModal from '../../../components/checkout/UpayPaymentModal';
import { verifyPaymentAutomatic, type VerificationResult } from '../../../services/automaticPaymentVerificationService';
import { checkAccountStatus } from '../../../services/accountStatusService';
import { BANGLADESH_DISTRICTS } from '../../../data/bangladeshDistricts';
import { getDivisionByDistrict } from '../../../utils/deliveryCalculator';
import { 
  generateUniqueVendorSlug, 
  PRIMARY_DOMAIN 
} from '../../../utils/subdomain';

export default function VendorRegistration() {
  const { user, userData, logout, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingPending, setCheckingPending] = useState(true);
  const [pendingVendorInfo, setPendingVendorInfo] = useState<any>(null);
  const [copiedNumber, setCopiedNumber] = useState('');

  // New Payment System States (matching Checkout)
  const [showPaymentSelectionModal, setShowPaymentSelectionModal] = useState<boolean>(false);
  const [showBkashModal, setShowBkashModal] = useState<boolean>(false);
  const [showNagadModal, setShowNagadModal] = useState<boolean>(false);
  const [showRocketModal, setShowRocketModal] = useState<boolean>(false);
  const [showUpayModal, setShowUpayModal] = useState<boolean>(false);
  const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<'bkash' | 'nagad' | 'rocket' | 'upay' | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string>('');
  // Temporary testing fee: exactly ৳10 (Vendor Activation / Registration Fee)
  const [registrationFeeAmount, setRegistrationFeeAmount] = useState<number>(10);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string>(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let inv = 'S2N';
    for (let i = 0; i < 9; i++) {
      inv += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return inv;
  });

  // Dynamic fee hook - check settings/vendor or settings/appConfig
  useEffect(() => {
    async function loadDynamicFee() {
      try {
        const [vendorSet, appConf] = await Promise.all([
          rtdbGet<any>('settings/vendor').catch(() => null),
          rtdbGet<any>('settings/appConfig').catch(() => null)
        ]);
        const dynamicFee = vendorSet?.registrationFee ?? vendorSet?.packageFee ?? appConf?.vendorRegistrationFee;
        if (typeof dynamicFee === 'number' && dynamicFee > 0) {
          setRegistrationFeeAmount(dynamicFee);
        }
      } catch (err) {
        console.warn('Could not load vendor registration fee:', err);
      }
    }
    loadDynamicFee();
  }, []);

  // Check if current user already has a vendor profile
  const checkExistingVendor = async () => {
    if (!user) {
      setCheckingPending(false);
      return;
    }
    try {
      const status = await checkAccountStatus(user.email, user.uid);
      if (status.hasActiveVendor) {
        navigate('/vendor-dashboard', { replace: true });
        return;
      }
      if (status.isPendingVendor && status.vendorData) {
        setPendingVendorInfo(status.vendorData);
      }

      const vData = await rtdbGet<any>('vendors/' + user.uid);
      if (vData) {
        const rawStatus = (vData.status || '').toLowerCase();
        const isPaid = Boolean(
          vData.registrationPayment === 'completed' ||
          vData.transactionId ||
          vData.verifiedAt ||
          vData.paymentMethod ||
          vData.registrationFee === 0
        );
        if ((rawStatus === 'approved' || rawStatus === 'active') && isPaid) {
          navigate('/vendor-dashboard', { replace: true });
          return;
        }

        // Keep pending info for reference and pre-fill form, but DO NOT jump to Step 3 automatically
        setPendingVendorInfo(vData);
        const preDist = vData.district || vData.vendorDistrict || vData.address?.district || vData.address?.state || '';
        const preUp = vData.upazila || vData.vendorUpazila || vData.address?.upazila || vData.address?.city || '';
        const preDiv = vData.division || vData.vendorDivision || vData.address?.division || (preDist ? getDivisionByDistrict(preDist) : '');

        setFormData(prev => ({
          ...prev,
          storeName: prev.storeName || vData.storeName || vData.shopName || '',
          ownerName: prev.ownerName || vData.ownerName || vData.name || '',
          mobileNumber: prev.mobileNumber || vData.mobileNumber || vData.phone || '',
          district: prev.district || preDist,
          upazila: prev.upazila || preUp,
          division: prev.division || preDiv,
          address: prev.address || (typeof vData.address === 'string' ? vData.address : (vData.address?.street || vData.address?.area)) || '',
          facebookPage: prev.facebookPage || vData.facebookPage || '',
          whatsappNumber: prev.whatsappNumber || vData.whatsappNumber || ''
        }));
      }
    } catch (e) {
      console.error('Error checking vendor doc:', e);
    } finally {
      setCheckingPending(false);
    }
  };

  useEffect(() => {
    checkExistingVendor();

    if (user) {
      // Auto-fill existing user details
      setFormData(prev => ({
        ...prev,
        email: prev.email || user.email || '',
        ownerName: prev.ownerName || user.displayName || userData?.name || '',
        mobileNumber: prev.mobileNumber || userData?.phone || ''
      }));
    }
  }, [user, userData]);

  // Form Data
  const [formData, setFormData] = useState({
    storeName: '',
    ownerName: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    district: '',
    upazila: '',
    division: '',
    address: '',
    facebookPage: '',
    whatsappNumber: ''
  });

  // Payment Data
  const [paymentMethod, setPaymentMethod] = useState<'bKash' | 'Nagad' | 'Rocket' | 'Upay' | ''>('bKash');
  const [transactionId, setTransactionId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'district') {
      const div = getDivisionByDistrict(value);
      setFormData(prev => ({ ...prev, district: value, upazila: '', division: div }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNumber(text);
    toast.success('নাম্বার কপি করা হয়েছে!');
    setTimeout(() => setCopiedNumber(''), 2500);
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.storeName.trim() || !formData.ownerName.trim() || !formData.mobileNumber.trim() || !formData.address.trim() || !formData.email.trim()) {
      toast.error('সকল প্রয়োজনীয় তথ্য পূরণ করুন');
      return;
    }

    if (!formData.district.trim()) {
      toast.error('আপনার স্টোরের জেলা নির্বাচন করুন');
      return;
    }

    if (!formData.upazila.trim()) {
      toast.error('আপনার স্টোরের থানা/উপজেলা নির্বাচন করুন');
      return;
    }

    if (!user) {
      if (!formData.password) {
        toast.error('একটি পাসওয়ার্ড দিন');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('উভয় পাসওয়ার্ড একই হতে হবে');
        return;
      }
    } else {
      if (formData.password) {
        if (formData.password.length < 6) {
          toast.error('পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে');
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          toast.error('উভয় পাসওয়ার্ড একই হতে হবে');
          return;
        }
      }
    }
    
    // Generate new invoice ID if needed
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
              toast.error('এই ইমেইলটি আগে থেকেই খোলা আছে। দয়া করে সঠিক পাসওয়ার্ড দিন অথবা লগইন করুন।');
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

      // Call Automatic Payment Verification with strict 8-second safety timeout
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
          userType: 'vendor',
          contextData: {
            storeName: formData.storeName.trim(),
            ownerName: formData.ownerName.trim(),
            mobileNumber: formData.mobileNumber.trim()
          }
        }),
        timeoutPromise
      ]);

      if (result.status === 'verified') {
        const storeSlug = await generateUniqueVendorSlug(formData.storeName.trim(), currentUserId);
        const finalDistrict = formData.district.trim();
        const finalUpazila = formData.upazila.trim();
        const finalDivision = formData.division.trim() || getDivisionByDistrict(finalDistrict);
        const finalStreet = formData.address.trim();

        const structuredAddress = {
          street: finalStreet,
          area: finalStreet,
          city: finalUpazila,
          state: finalDistrict,
          district: finalDistrict,
          upazila: finalUpazila,
          division: finalDivision,
          zip: '',
          country: 'Bangladesh'
        };

        const structuredVendorLocation = {
          district: finalDistrict,
          upazila: finalUpazila,
          division: finalDivision,
          area: finalStreet
        };
        
        // Automatically approve vendor account and grant dashboard access (TASK 7)
        const activeVendorPayload = {
          vendorId: currentUserId,
          storeId: currentUserId,
          storeName: formData.storeName.trim(),
          shopName: formData.storeName.trim(),
          storeSlug: storeSlug,
          ownerName: formData.ownerName.trim(),
          name: formData.ownerName.trim(),
          mobileNumber: formData.mobileNumber.trim(),
          phone: formData.mobileNumber.trim(),
          email: formData.email.trim() || user?.email || '',
          address: structuredAddress,
          district: finalDistrict,
          upazila: finalUpazila,
          thana: finalUpazila,
          division: finalDivision,
          vendorDistrict: finalDistrict,
          vendorUpazila: finalUpazila,
          vendorDivision: finalDivision,
          vendorLocation: structuredVendorLocation,
          facebookPage: formData.facebookPage.trim(),
          whatsappNumber: formData.whatsappNumber.trim() || formData.mobileNumber.trim(),
          userId: currentUserId,
          logo: '',
          profileImage: '',
          banner: '',
          description: `Welcome to ${formData.storeName.trim()}`,
          status: 'active',
          registrationFee: registrationFeeAmount,
          registrationPayment: 'completed',
          paymentMethod: formattedMethod,
          transactionId: trxId.trim().toUpperCase(),
          invoiceId: currentInvoiceId,
          verifiedAt: result.verifiedAt || Date.now(),
          updatedAt: Date.now(),
          createdAt: Date.now()
        };

        // Cache locally for instantaneous session reliability
        try {
          localStorage.setItem('rj_active_vendor_' + currentUserId, JSON.stringify(activeVendorPayload));
          localStorage.setItem('rj_has_active_vendor_' + currentUserId, 'true');
          localStorage.setItem('rj_user_role_' + currentUserId, 'Vendor');
        } catch (_) {}

        // Write directly to Realtime Database
        const storePayload = {
          id: currentUserId,
          storeId: currentUserId,
          vendorId: currentUserId,
          storeName: formData.storeName.trim(),
          shopName: formData.storeName.trim(),
          storeSlug: storeSlug,
          ownerName: formData.ownerName.trim(),
          phone: formData.mobileNumber.trim(),
          email: formData.email.trim() || user?.email || '',
          address: structuredAddress,
          district: finalDistrict,
          upazila: finalUpazila,
          thana: finalUpazila,
          division: finalDivision,
          vendorDistrict: finalDistrict,
          vendorUpazila: finalUpazila,
          vendorDivision: finalDivision,
          vendorLocation: structuredVendorLocation,
          logo: '',
          profileImage: '',
          banner: '',
          description: `Welcome to ${formData.storeName.trim()}`,
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const initialProfilePayload = {
          vendorId: currentUserId,
          userId: currentUserId,
          name: formData.ownerName.trim(),
          ownerName: formData.ownerName.trim(),
          email: formData.email.trim() || user?.email || '',
          phone: formData.mobileNumber.trim(),
          contactNumber: formData.mobileNumber.trim(),
          whatsappNumber: formData.whatsappNumber.trim() || formData.mobileNumber.trim(),
          profileImage: '',
          logo: '',
          storeId: currentUserId,
          storeName: formData.storeName.trim(),
          shopName: formData.storeName.trim(),
          storeSlug: storeSlug,
          shopSlug: storeSlug,
          freeShopDomain: `${storeSlug}.${PRIMARY_DOMAIN}`,
          description: `Welcome to ${formData.storeName.trim()}`,
          category: 'Retail',
          address: structuredAddress,
          district: finalDistrict,
          upazila: finalUpazila,
          thana: finalUpazila,
          division: finalDivision,
          vendorDistrict: finalDistrict,
          vendorUpazila: finalUpazila,
          vendorDivision: finalDivision,
          vendorLocation: structuredVendorLocation,
          status: 'Active',
          verificationBadge: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        try {
          localStorage.setItem('rj_vendor_profile_' + currentUserId, JSON.stringify(initialProfilePayload));
        } catch (_) {}

        await Promise.allSettled([
          rtdbUpdate(`vendors/${currentUserId}`, activeVendorPayload),
          rtdbUpdate(`stores/${currentUserId}`, storePayload),
          rtdbUpdate(`vendor_profiles/${currentUserId}`, initialProfilePayload),
          rtdbUpdate(`users/${currentUserId}`, {
            name: formData.ownerName.trim(),
            email: formData.email.trim() || user?.email || '',
            phone: formData.mobileNumber.trim(),
            role: 'Vendor',
            updatedAt: Date.now()
          })
        ]);

        // Server-side synchronization
        try {
          fetch('/api/vendor/save-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vendorId: currentUserId,
              profileData: initialProfilePayload,
              vendorData: activeVendorPayload
            })
          }).catch(() => {});
        } catch (_) {}

        if (refreshUserData) {
          await refreshUserData().catch(() => {});
        }

        setShowBkashModal(false);
        setShowNagadModal(false);
        setShowRocketModal(false);
        setShowUpayModal(false);
        setShowPaymentSelectionModal(false);
        setLoading(false);

        toast.success('পেমেন্ট সফলভাবে যাচাই হয়েছে! ভেন্ডর ড্যাশবোর্ডে স্বাগতম।');
        navigate('/vendor-dashboard', { replace: true });
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
      console.error('Vendor Registration Error:', error);
      const errNotice = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
      setPaymentErrorMessage(errNotice);
      toast.error(errNotice, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans p-3 sm:p-6 md:p-8 lg:p-12 py-6 sm:py-10 md:py-14 pb-24 sm:pb-28 flex flex-col justify-center items-center">
      <div className="w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-sm sm:shadow-lg p-4 sm:p-7 md:p-9 border border-slate-200/80 relative transition-all">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4 mb-4 sm:mb-6">
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

        {/* Title & Icon Header */}
        <div className="text-center mb-5 sm:mb-7">
          <div className="w-10 h-10 sm:w-13 sm:h-13 bg-primary-main/10 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2.5 text-primary-main border border-primary-main/20 shadow-xs">
            <Store className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
            {step === 1 ? 'Vendor Registration' : 'Registration Fee Payment'}
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-slate-500 mt-1 max-w-lg mx-auto">
            {step === 1 ? 'Open your merchant store on RJ WORLD BD and start selling' : `Send ৳${registrationFeeAmount} registration fee to activate store`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Store & Owner Details */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onSubmit={handleProceedToPayment}
              className="space-y-3 sm:space-y-4 md:space-y-5"
            >

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                <div>
                  <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                    Store Name *
                  </label>
                  <input 
                    type="text" 
                    name="storeName" 
                    required 
                    value={formData.storeName} 
                    onChange={handleInputChange} 
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400" 
                    placeholder="RJ Fashion" 
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                    Owner Name *
                  </label>
                  <input 
                    type="text" 
                    name="ownerName" 
                    required 
                    value={formData.ownerName} 
                    onChange={handleInputChange} 
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400" 
                    placeholder="Full Name" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                <div>
                  <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                    Mobile Number *
                  </label>
                  <input 
                    type="tel" 
                    name="mobileNumber" 
                    required 
                    inputMode="tel"
                    value={formData.mobileNumber} 
                    onChange={handleInputChange} 
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400" 
                    placeholder="017XXXXXXXX" 
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                    WhatsApp (Optional)
                  </label>
                  <input 
                    type="tel" 
                    name="whatsappNumber" 
                    inputMode="tel"
                    value={formData.whatsappNumber} 
                    onChange={handleInputChange} 
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400" 
                    placeholder="018XXXXXXXX" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                  Email Address *
                </label>
                <input 
                  type="email" 
                  name="email" 
                  required 
                  inputMode="email"
                  value={formData.email} 
                  onChange={handleInputChange} 
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400" 
                  placeholder="vendor@example.com" 
                />
              </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                  <div>
                    <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                      Password {user ? '(Optional)' : '*'}
                    </label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="password" 
                        required={!user} 
                        value={formData.password} 
                        onChange={handleInputChange} 
                        className="w-full pl-3 pr-9 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all" 
                        placeholder={user ? "Keep existing password or set new" : "••••••"} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1 sm:mb-1.5">
                      Confirm Pass {user ? '(Optional)' : '*'}
                    </label>
                    <div className="relative">
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        name="confirmPassword" 
                        required={!user && Boolean(formData.password)} 
                        value={formData.confirmPassword} 
                        onChange={handleInputChange} 
                        className="w-full pl-3 pr-9 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all" 
                        placeholder={user ? "Confirm password" : "••••••"} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

              {/* Store / Pickup Location Selection (Crucial for Pathao & Courier Dynamic Rates) */}
              <div className="space-y-3 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="block text-xs sm:text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wider">
                    স্টোর / পিকআপ লোকেশন (ডেলিভারি চার্জ নির্ধারণের জন্য) *
                  </label>
                  <span className="text-[10px] sm:text-xs text-primary-main font-medium bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                    পাথাও রেট উপযোগী
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      জেলা (District) *
                    </label>
                    <select
                      name="district"
                      required
                      value={formData.district}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg sm:rounded-xl focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all text-slate-800"
                    >
                      <option value="">জেলা নির্বাচন করুন</option>
                      {BANGLADESH_DISTRICTS.map(d => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      থানা / উপজেলা (Upazila / Thana) *
                    </label>
                    <select
                      name="upazila"
                      required
                      disabled={!formData.district}
                      value={formData.upazila}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg sm:rounded-xl focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {formData.district ? 'থানা/উপজেলা নির্বাচন করুন' : 'আগে জেলা নির্বাচন করুন'}
                      </option>
                      {(BANGLADESH_DISTRICTS.find(d => d.name === formData.district || d.id === formData.district)?.upazilas || []).map(up => {
                        const upName = typeof up === 'string' ? up : up.name;
                        const upId = typeof up === 'string' ? up : up.id;
                        return (
                          <option key={upId} value={upName}>
                            {upName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    বিস্তারিত পিকআপ ঠিকানা (রাস্তা, বাজার, শপ নম্বর) *
                  </label>
                  <textarea 
                    name="address" 
                    required 
                    value={formData.address} 
                    onChange={handleInputChange} 
                    rows={2} 
                    className="w-full px-3 sm:px-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg sm:rounded-xl focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all resize-none placeholder:text-slate-400" 
                    placeholder="যেমন: দোকান নং ১২, নিউ মার্কেট, মেইন রোড" 
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    💡 কাস্টমারের অর্ডার প্লেসের সময় এই লোকেশন এবং কাস্টমারের ঠিকানার মধ্যকার দূরত্ব অনুযায়ী নিখুঁত পাথাও ডেলিভারি চার্জ হিসাব করা হবে।
                  </p>
                </div>
              </div>

              {/* Highly visible Proceed button */}
              <div className="pt-2 sm:pt-3">
                <button 
                  type="submit" 
                  className="w-full h-11 sm:h-12 md:h-13 bg-primary-main hover:bg-sky-600 active:bg-sky-700 text-white text-xs sm:text-sm md:text-base font-bold rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-primary-main/25 active:scale-[0.99] transition-all cursor-pointer"
                >
                  Continue to Payment <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="text-center text-xs sm:text-sm text-slate-500 pt-1">
                Already registered?{' '}
                <Link to="/vendor-login" className="font-bold text-primary-main hover:underline">
                  Login
                </Link>
              </div>
            </motion.form>
          )}

          {/* STEP 2: Registration Fee Payment Summary & Action */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4 sm:space-y-5"
            >
              {/* Fee badge */}
              <div className="bg-blue-50/80 border border-blue-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
                <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-700">
                  One-time Registration Fee
                </div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-tight mt-1.5">৳{registrationFeeAmount}</div>
                <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1.5">
                  স্টোর এক্টিভেশনের জন্য ওয়ান-টাইম রেজিস্ট্রেশন ফি প্রদান করুন
                </p>
              </div>

              {/* Vendor & Store Summary */}
              <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200/70 text-left text-xs sm:text-sm md:text-base space-y-2.5 sm:space-y-3.5">
                <div className="flex justify-between items-center text-xs sm:text-sm md:text-base border-b border-slate-200/60 pb-2 sm:pb-2.5">
                  <span className="text-slate-500">Store Name:</span>
                  <span className="font-bold text-slate-800">{formData.storeName || 'My Store'}</span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm md:text-base border-b border-slate-200/60 pb-2 sm:pb-2.5">
                  <span className="text-slate-500">Owner Name:</span>
                  <span className="font-bold text-slate-800">{formData.ownerName || 'Owner'}</span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm md:text-base border-b border-slate-200/60 pb-2 sm:pb-2.5">
                  <span className="text-slate-500">Mobile Number:</span>
                  <span className="font-bold text-slate-800">{formData.mobileNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm md:text-base">
                  <span className="text-slate-500">Invoice ID:</span>
                  <span className="font-bold text-slate-800 tracking-wide">{currentInvoiceId}</span>
                </div>
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
          paymentType="vendor_registration_fee"
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
      </div>
    </div>
  );
}


