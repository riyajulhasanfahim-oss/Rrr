import React, { useEffect, useState, useMemo } from 'react';
import { rtdbList, rtdbUpdate } from '../../lib/rtdb';
import { 
  BadgeCheck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  Sliders, 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  Search, 
  Filter, 
  Plus, 
  X, 
  Store, 
  Phone,
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import VerifiedBadge from '../../components/ui/VerifiedBadge';
import { 
  getVerifiedBadgeSettings, 
  saveVerifiedBadgeSettings, 
  getBadgeExpiryDetails,
  calculateBadgeExpiry,
  grantOrRenewVendorBadge,
  revokeVendorBadge,
  VerifiedBadgeSettings,
  DEFAULT_BADGE_SETTINGS
} from '../../services/verifiedBadgeService';

const formatDateVal = (val: any) => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'dd MMM yyyy');
  } catch {
    return 'N/A';
  }
};

export default function AdminVerifiedSellers() {
  const [activeTab, setActiveTab] = useState<'settings' | 'vendors' | 'requests'>('settings');
  const [requests, setRequests] = useState<any[]>([]);
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<VerifiedBadgeSettings>(DEFAULT_BADGE_SETTINGS);
  const [priceInput, setPriceInput] = useState<number>(DEFAULT_BADGE_SETTINGS.price);
  const [monthsInput, setMonthsInput] = useState<number>(DEFAULT_BADGE_SETTINGS.validityMonths);
  const [savingSettings, setSavingSettings] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'pending'>('all');

  // Action modals
  const [renewModalVendor, setRenewModalVendor] = useState<any | null>(null);
  const [renewMonths, setRenewMonths] = useState<number>(2);
  const [renewExtendOption, setRenewExtendOption] = useState<'fresh' | 'extend'>('fresh');
  const [isSubmittingRenew, setIsSubmittingRenew] = useState(false);

  // Manual Grant Modal
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantSelectedVendorId, setGrantSelectedVendorId] = useState('');
  const [grantMonths, setGrantMonths] = useState<number>(2);
  const [grantSearch, setGrantSearch] = useState('');
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchBadgeSettings(),
        fetchRequestsAndVendors()
      ]);
    } catch (err) {
      console.error('Error loading verified seller data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBadgeSettings = async () => {
    try {
      const s = await getVerifiedBadgeSettings();
      setSettings(s);
      setPriceInput(s.price);
      setMonthsInput(s.validityMonths);
      setRenewMonths(s.validityMonths);
      setGrantMonths(s.validityMonths);
    } catch (err) {
      console.warn('Failed to load badge settings:', err);
    }
  };

  const fetchRequestsAndVendors = async () => {
    const reqMap = new Map<string, any>();

    // 1. Fetch from RTDB verified_seller_requests
    const rtdbReqs = await rtdbList<any>('verified_seller_requests').catch(() => []);
    rtdbReqs.forEach(({ id, data }) => {
      if (id && data) {
        reqMap.set(id, { id, ...data });
      }
    });

    // 2. Fetch all vendors to track active and expired badges
    try {
      const vendorsList = await rtdbList<any>('vendors').catch(() => []);
      const parsedVendors: any[] = [];

      vendorsList.forEach(({ id, data }) => {
        if (!id || !data) return;
        const vendorObj = { id, ...data };
        parsedVendors.push(vendorObj);

        // If vendor requested verification and not in reqMap
        if (data.verificationStatus === 'pending' || data.verificationRequested === true) {
          const reqKey = 'req_vendor_' + id;
          if (!reqMap.has(reqKey)) {
            reqMap.set(reqKey, {
              id: reqKey,
              vendorId: id,
              storeName: data.storeName || data.shopName || 'Store ' + id.substring(0, 5),
              sellerName: data.ownerName || data.name || 'Vendor',
              phone: data.phone || data.mobileNumber || 'N/A',
              paymentAmount: data.verifiedPlanPrice || settings.price,
              requestDate: data.verificationRequestedAt || data.updatedAt || Date.now(),
              status: 'pending',
              notes: data.verificationNotes || 'Requested via vendor dashboard'
            });
          }
        }
      });

      setAllVendors(parsedVendors);
    } catch (err) {
      console.warn('Error fetching vendors in RTDB:', err);
    }

    const allReqs = Array.from(reqMap.values()).sort((a, b) => (b.requestDate || 0) - (a.requestDate || 0));
    setRequests(allReqs);
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (priceInput < 0) {
      toast.error('টাকার পরিমাণ ০ বা তার বেশি হতে হবে');
      return;
    }
    if (monthsInput < 1) {
      toast.error('মেয়াদের সময়কাল কমপক্ষে ১ মাস হতে হবে');
      return;
    }

    setSavingSettings(true);
    try {
      const updated = await saveVerifiedBadgeSettings({
        price: Number(priceInput),
        validityMonths: Number(monthsInput)
      });
      setSettings(updated);
      setRenewMonths(updated.validityMonths);
      setGrantMonths(updated.validityMonths);
      toast.success(`ভেরিফাইড ব্যাজের মূল্য (৳${updated.price}) ও মেয়াদ (${updated.validityMonths} মাস) সংরক্ষিত হয়েছে!`);
    } catch (err) {
      console.error('Failed to save badge settings:', err);
      toast.error('সেটিংস সংরক্ষণ করতে ব্যর্থ হয়েছে');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAction = async (requestId: string, vendorId: string, action: 'approved' | 'rejected') => {
    try {
      const isApproved = action === 'approved';

      if (isApproved) {
        // Grant/Renew with current configured months
        await grantOrRenewVendorBadge(vendorId, {
          months: settings.validityMonths,
          price: settings.price,
          paymentMethod: 'verified_seller_request',
          trxId: 'REQUEST_APPROVAL'
        });

        await rtdbUpdate(`verified_seller_requests/${requestId}`, {
          status: 'approved',
          approvedDate: Date.now(),
          durationMonths: settings.validityMonths,
          planExpiresAt: calculateBadgeExpiry(Date.now(), settings.validityMonths)
        });

        toast.success(`অনুরোধ অনুমোদিত! ভেন্ডর ${settings.validityMonths} মাসের জন্য ভেরিফাইড হয়েছে।`);
      } else {
        await revokeVendorBadge(vendorId);
        await rtdbUpdate(`verified_seller_requests/${requestId}`, {
          status: 'rejected',
          rejectedDate: Date.now()
        });
        toast.success('অনুরোধ বাতিল করা হয়েছে');
      }

      fetchRequestsAndVendors();
    } catch (error) {
      console.error(`Error updating request to ${action}:`, error);
      toast.error('Action failed');
    }
  };

  const handleApproveAll = async () => {
    const pendingRequests = requests.filter(req => req.status === 'pending');
    if (pendingRequests.length === 0) {
      toast.error('No pending requests to approve');
      return;
    }

    setIsApprovingAll(true);
    try {
      await Promise.allSettled(
        pendingRequests.map(async req => {
          await grantOrRenewVendorBadge(req.vendorId, {
            months: settings.validityMonths,
            price: settings.price,
            sellerName: req.sellerName,
            storeName: req.storeName
          });
          return rtdbUpdate(`verified_seller_requests/${req.id}`, {
            status: 'approved',
            approvedDate: Date.now(),
            durationMonths: settings.validityMonths,
            planExpiresAt: calculateBadgeExpiry(Date.now(), settings.validityMonths)
          });
        })
      );

      toast.success(`সফলভাবে ${pendingRequests.length} টি আবেদন অনুমোদন করা হয়েছে (${settings.validityMonths} মাস মেয়াদে)`);
      fetchRequestsAndVendors();
    } catch (error) {
      console.error('Error approving all requests:', error);
      toast.error('Failed to approve all requests');
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleRenewVendor = async () => {
    if (!renewModalVendor) return;
    setIsSubmittingRenew(true);
    try {
      const extend = renewExtendOption === 'extend';
      await grantOrRenewVendorBadge(renewModalVendor.id, {
        months: renewMonths,
        price: settings.price,
        extendExisting: extend,
        sellerName: renewModalVendor.ownerName || renewModalVendor.name,
        storeName: renewModalVendor.storeName || renewModalVendor.shopName
      });

      toast.success(
        extend 
          ? `ভেন্ডরের মেয়াদ আরও ${renewMonths} মাস বাড়ানো হয়েছে!` 
          : `আজ থেকে নতুন করে ${renewMonths} মাসের দিন গণনা শুরু হয়েছে!`
      );
      setRenewModalVendor(null);
      fetchRequestsAndVendors();
    } catch (err: any) {
      console.error('Error renewing vendor:', err);
      toast.error(err.message || 'রিনিউ করতে ব্যর্থ হয়েছে');
    } finally {
      setIsSubmittingRenew(false);
    }
  };

  const handleRevokeVendor = async (vendor: any) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${vendor.storeName || vendor.shopName || 'এই ভেন্ডর'}"-এর ভেরিফাইড ব্যাজ বাতিল করতে চান?`)) {
      return;
    }
    try {
      await revokeVendorBadge(vendor.id);
      toast.success('ভেরিফাইড ব্যাজ সফলভাবে বাতিল করা হয়েছে');
      fetchRequestsAndVendors();
    } catch (err) {
      console.error('Error revoking badge:', err);
      toast.error('ব্যাজ বাতিল করতে ব্যর্থ হয়েছে');
    }
  };

  const handleGrantBadge = async () => {
    if (!grantSelectedVendorId) {
      toast.error('দয়া করে একটি ভেন্ডর নির্বাচন করুন');
      return;
    }

    const selectedVendor = allVendors.find(v => v.id === grantSelectedVendorId);
    setIsSubmittingGrant(true);
    try {
      await grantOrRenewVendorBadge(grantSelectedVendorId, {
        months: grantMonths,
        price: settings.price,
        sellerName: selectedVendor?.ownerName || selectedVendor?.name || 'Vendor',
        storeName: selectedVendor?.storeName || selectedVendor?.shopName || 'Store'
      });

      toast.success(`ভেন্ডরকে ${grantMonths} মাসের ভেরিফাইড ব্যাজ প্রদান করা হয়েছে (আজ থেকে গণনা শুরু)!`);
      setShowGrantModal(false);
      setGrantSelectedVendorId('');
      fetchRequestsAndVendors();
    } catch (err: any) {
      console.error('Error granting badge:', err);
      toast.error(err.message || 'ব্যাজ প্রদান করতে ব্যর্থ হয়েছে');
    } finally {
      setIsSubmittingGrant(false);
    }
  };

  // Compute vendor list enriched with live expiry calculations
  const enrichedVendors = useMemo(() => {
    return allVendors.map(v => {
      const details = getBadgeExpiryDetails(v);
      return {
        ...v,
        expiryDetails: details
      };
    });
  }, [allVendors]);

  // Statistics
  const stats = useMemo(() => {
    let active = 0;
    let expired = 0;
    let pending = requests.filter(r => r.status === 'pending').length;

    enrichedVendors.forEach(v => {
      if (v.expiryDetails.isVerified) {
        active++;
      } else if (v.expiryDetails.isExpired) {
        expired++;
      }
    });

    return {
      active,
      expired,
      pending,
      totalTracked: active + expired
    };
  }, [enrichedVendors, requests]);

  // Filtered vendors for table
  const filteredVendors = useMemo(() => {
    return enrichedVendors
      .filter(v => {
        // Status filter
        if (statusFilter === 'active' && !v.expiryDetails.isVerified) return false;
        if (statusFilter === 'expired' && !v.expiryDetails.isExpired) return false;
        if (statusFilter === 'pending') {
          const isPending = v.verificationStatus === 'pending' || v.verificationRequested;
          if (!isPending) return false;
        }

        // If 'all', show anyone who is verified, expired, or has pending verification
        if (statusFilter === 'all') {
          const hasHistory = 
            v.expiryDetails.isVerified || 
            v.expiryDetails.isExpired || 
            v.verificationStatus === 'pending' ||
            v.verifiedAt ||
            v.planExpiresAt;
          if (!hasHistory) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const name = (v.storeName || v.shopName || '').toLowerCase();
          const seller = (v.ownerName || v.name || '').toLowerCase();
          const phone = (v.phone || v.mobileNumber || '').toLowerCase();
          const id = (v.id || '').toLowerCase();
          return name.includes(q) || seller.includes(q) || phone.includes(q) || id.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        // Sort active first, then by remaining days, then by request date
        if (a.expiryDetails.isVerified && !b.expiryDetails.isVerified) return -1;
        if (!a.expiryDetails.isVerified && b.expiryDetails.isVerified) return 1;
        return (b.verifiedAt || b.updatedAt || 0) - (a.verifiedAt || a.updatedAt || 0);
      });
  }, [enrichedVendors, statusFilter, searchQuery]);

  // Filtered vendors for manual grant search
  const grantSearchableVendors = useMemo(() => {
    if (!grantSearch.trim()) return allVendors.slice(0, 15);
    const q = grantSearch.toLowerCase();
    return allVendors
      .filter(v => {
        const name = (v.storeName || v.shopName || '').toLowerCase();
        const seller = (v.ownerName || v.name || '').toLowerCase();
        const phone = (v.phone || v.mobileNumber || '').toLowerCase();
        return name.includes(q) || seller.includes(q) || phone.includes(q);
      })
      .slice(0, 20);
  }, [allVendors, grantSearch]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm shrink-0">
            <BadgeCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">ভেরিফাইড ব্যাজ ম্যানেজমেন্ট</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                Verified Store Engine
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              ভেন্ডরদের ভেরিফাইড ব্যাজের ফি, মেয়াদের সময়সীমা (মাস) ও স্বয়ংক্রিয় দিন গণনা নিয়ন্ত্রণ করুন।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setGrantSelectedVendorId('');
              setShowGrantModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            নতুন ভেন্ডরকে ব্যাজ দিন
          </button>
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl transition-colors shadow-2xs"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Card 1: Active Price & Months */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold">বর্তমান ব্যাজ ফি</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900">৳{settings.price}</div>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            মেয়াদ: <span className="font-bold text-blue-700">{settings.validityMonths} মাস</span>
          </div>
        </div>

        {/* Card 2: Active Verified Stores */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100/90 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold text-emerald-800">সক্রিয় ভেরিফাইড স্টোর</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700">{stats.active}</div>
          <div className="text-[11px] text-emerald-600 mt-1 font-medium">
            বৈধ ভেরিফাইড চিহ্ন চালু আছে
          </div>
        </div>

        {/* Card 3: Expired Stores */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100/90 shadow-2xs bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold text-amber-800">মেয়াদোত্তীর্ণ স্টোর</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700">{stats.expired}</div>
          <div className="text-[11px] text-amber-600 mt-1 font-medium">
            চিহ্ন স্বয়ংক্রিয়ভাবে উঠে গেছে
          </div>
        </div>

        {/* Card 4: Pending Requests */}
        <div className="bg-white p-4 rounded-2xl border border-blue-100/90 shadow-2xs bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold text-blue-800">অপেক্ষমান আবেদন</span>
            <RotateCcw className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700">{stats.pending}</div>
          <div className="text-[11px] text-blue-600 mt-1 font-medium">
            অনুমোদনের অপেক্ষায়
          </div>
        </div>
      </div>

      {/* Main Configuration Card (User Requested Core Feature) */}
      <div className="bg-white rounded-2xl border-2 border-blue-100/80 shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                ভেরিফাইড ব্যাজের মূল্য ও মেয়াদ নির্ধারণ
              </h2>
              <p className="text-xs text-gray-500">
                এখানে টাকার পরিমাণ ও মাস পরিবর্তন করলে ভেন্ডর প্যানেল এবং নতুন কেনা ব্যাজে তা সাথে সাথে কার্যকর হবে।
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>প্রতিটি ক্রয়ে ঐদিন থেকে দিন গণনা হবে</span>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="mt-4 sm:mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
            {/* Price Input */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                ব্যাজের টাকার পরিমাণ (ফি)
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 font-bold">
                  ৳
                </div>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={priceInput}
                  onChange={(e) => setPriceInput(Number(e.target.value))}
                  placeholder="যেমন: 100"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">ভেন্ডর ড্যাশবোর্ডে এই পরিমাণ টাকা পেমেন্ট করতে হবে।</p>
            </div>

            {/* Months Input */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                মেয়াদের সময়কাল (মাসের সংখ্যা)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 rounded-xl shadow-2xs">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={monthsInput}
                    onChange={(e) => setMonthsInput(Number(e.target.value))}
                    placeholder="যেমন: 2"
                    className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-gray-500">
                    মাস
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="hidden sm:flex items-center gap-1">
                  {[1, 2, 3, 6, 12].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonthsInput(m)}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        monthsInput === m 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {m}ম
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">ক্রয়ের দিন থেকে শুরু হয়ে নির্দিষ্ট মাস পর্যন্ত চলবে।</p>
            </div>

            {/* Save Button */}
            <div className="lg:col-span-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {savingSettings ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
              </button>
            </div>
          </div>

          {/* Explanatory Rule Banner */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 sm:p-3.5 flex items-start gap-2.5 text-xs text-slate-700">
            <div className="p-1 bg-white rounded-lg border border-slate-200 shadow-2xs text-blue-600 shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="leading-relaxed">
              <strong className="text-slate-900 font-bold">স্বয়ংক্রিয় দিন গণনা ও মেয়াদ সমাপ্তির নিয়ম:</strong> যেই ভেন্ডর যত তারিখে ভেরিফাইড ব্যাজ নিবে, 
              ঠিক ঐদিন থেকে দিন গণনা শুরু হবে। নির্ধারিত <span className="font-bold text-blue-700">{settings.validityMonths} মাস</span> মেয়াদ শেষ হওয়ার পর 
              ভেন্ডরের স্টোর ও প্রোডাক্ট থেকে ভেরিফাইড নীল টিক চিহ্নটি স্বয়ংক্রিয়ভাবে উঠে যাবে। ভেন্ডর পরবর্তীতে আবার কিনলে পুনরায় নতুন করে 
              দিন গণনা শুরু হবে।
            </div>
          </div>
        </form>
      </div>

      {/* Tabs Switcher: Requests, Verified Vendors, Settings */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-xl border border-gray-200/80 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('vendors')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === 'vendors'
                ? 'bg-white text-gray-900 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Store className="w-4 h-4 text-blue-600" />
            <span>ভেরিফাইড ভেন্ডর তালিকা</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800">
              {stats.totalTracked}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === 'requests'
                ? 'bg-white text-gray-900 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>অনুরোধসমূহ (Requests)</span>
            {stats.pending > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                {stats.pending}
              </span>
            )}
          </button>
        </div>

        {/* Tab-specific actions */}
        {activeTab === 'requests' && requests.some(req => req.status === 'pending') && (
          <button
            onClick={handleApproveAll}
            disabled={isApprovingAll}
            className="flex items-center gap-2 px-3.5 py-2 bg-green-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isApprovingAll ? 'অনুমোদন হচ্ছে...' : `সবগুলো অনুমোদন (${settings.validityMonths} মাস মেয়াদে)`}
          </button>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      {activeTab === 'vendors' && (
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/90 shadow-2xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="দোকানের নাম, ভেন্ডর বা ফোন..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-gray-500 font-semibold flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> ফিল্টার:
            </span>
            {(['all', 'active', 'expired', 'pending'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === tab
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab === 'all' && 'সকল'}
                {tab === 'active' && 'সক্রিয় ব্যাজ'}
                {tab === 'expired' && 'মেয়াদোত্তীর্ণ'}
                {tab === 'pending' && 'পেন্ডিং'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 1: Verified Vendors List with Real-time Expiry Counter */}
      {activeTab === 'vendors' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-gray-600">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-700 font-bold">
                <tr>
                  <th className="px-5 py-3.5">স্টোর ও ভেন্ডর</th>
                  <th className="px-5 py-3.5">যোগাযোগ</th>
                  <th className="px-5 py-3.5">শুরুর তারিখ</th>
                  <th className="px-5 py-3.5">মেয়াদ শেষের তারিখ</th>
                  <th className="px-5 py-3.5">অবস্থা ও দিন গণনা</th>
                  <th className="px-5 py-3.5 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-xs text-gray-400 mt-2 font-medium">ভেন্ডর ডেটা লোড হচ্ছে...</p>
                    </td>
                  </tr>
                ) : filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Store className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="font-semibold text-gray-700 text-sm">কোন ভেরিফাইড ভেন্ডর পাওয়া যায়নি</p>
                      <p className="text-xs text-gray-400 mt-0.5">নতুন ভেন্ডরকে ব্যাজ দিতে উপরের "নতুন ভেন্ডরকে ব্যাজ দিন" বাটনে ক্লিক করুন।</p>
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => {
                    const expiry = vendor.expiryDetails;
                    return (
                      <tr key={vendor.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Store & Vendor */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-gray-900 text-sm">
                              {vendor.storeName || vendor.shopName || 'Unnamed Store'}
                            </div>
                            {expiry.isVerified && <VerifiedBadge size="xs" />}
                          </div>
                          <div className="text-xs text-gray-500">
                            মালিক: {vendor.ownerName || vendor.name || 'Vendor'}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            ID: {vendor.id}
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-gray-700 text-xs font-medium">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span>{vendor.phone || vendor.mobileNumber || vendor.contactNumber || 'N/A'}</span>
                          </div>
                        </td>

                        {/* Verified Start Date */}
                        <td className="px-5 py-4">
                          <div className="text-xs font-semibold text-gray-800">
                            {formatDateVal(expiry.verifiedAt || vendor.verifiedAt)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            প্যাকেজ: {expiry.durationMonths || settings.validityMonths} মাস
                          </div>
                        </td>

                        {/* Expiry Date */}
                        <td className="px-5 py-4">
                          <div className="text-xs font-bold text-gray-900">
                            {formatDateVal(expiry.expiresAt || vendor.planExpiresAt)}
                          </div>
                          {expiry.expiresAt && (
                            <div className="text-[10px] text-gray-500">
                              {expiry.isExpired ? 'মেয়াদ উত্তীর্ণ' : 'নির্ধারিত শেষ তারিখ'}
                            </div>
                          )}
                        </td>

                        {/* Live Status & Days Countdown */}
                        <td className="px-5 py-4">
                          {expiry.isVerified ? (
                            <div>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                expiry.statusColor === 'amber'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                {expiry.statusTextBn}
                              </span>
                              <div className="text-[10px] text-gray-500 mt-1">
                                স্টোরে ভেরিফাইড নীল টিক চালু আছে
                              </div>
                            </div>
                          ) : expiry.isExpired ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {expiry.statusTextBn}
                              </span>
                              <div className="text-[10px] text-red-600 mt-1">
                                ব্যাজ স্বয়ংক্রিয়ভাবে মুছে গেছে
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              আনভেরিফাইড
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              onClick={() => {
                                setRenewModalVendor(vendor);
                                setRenewMonths(settings.validityMonths);
                                setRenewExtendOption(expiry.isVerified ? 'extend' : 'fresh');
                              }}
                              className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-2xs"
                              title="মেয়াদ বৃদ্ধি বা নবায়ন করুন"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              {expiry.isExpired ? 'নতুন করে চালু' : 'মেয়াদ বৃদ্ধি'}
                            </button>

                            {expiry.isVerified && (
                              <button
                                onClick={() => handleRevokeVendor(vendor)}
                                className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 font-semibold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-2xs"
                                title="ভেরিফাইড ব্যাজ বাতিল করুন"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                বাতিল
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Pending Requests */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-gray-600">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-700 font-bold">
                <tr>
                  <th className="px-6 py-4">স্টোর / ভেন্ডর</th>
                  <th className="px-6 py-4">আবেদনের তারিখ</th>
                  <th className="px-6 py-4">পেমেন্ট বিবরণ</th>
                  <th className="px-6 py-4">অবস্থা</th>
                  <th className="px-6 py-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="font-semibold text-gray-700">কোন পেন্ডিং ভেরিফিকেশন আবেদন পাওয়া যায়নি</p>
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{req.storeName}</div>
                        <div className="text-xs text-gray-500">{req.sellerName}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {req.vendorId.substring(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {formatDateVal(req.requestDate)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">৳{req.paymentAmount || settings.price}</div>
                        {req.paymentMethod && <div className="text-xs text-gray-600 mt-0.5 font-medium">মেথড: {req.paymentMethod}</div>}
                        {req.trxId && <div className="text-xs text-gray-500 font-mono">TrxID: {req.trxId}</div>}
                      </td>
                      <td className="px-6 py-4">
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                            <CheckCircle className="w-3.5 h-3.5" /> Approved
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                            <XCircle className="w-3.5 h-3.5" /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleAction(req.id, req.vendorId, 'approved')}
                              className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-2xs"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> অনুমোদন ({settings.validityMonths} মাস)
                            </button>
                            <button
                              onClick={() => handleAction(req.id, req.vendorId, 'rejected')}
                              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-2xs"
                            >
                              <XCircle className="w-3.5 h-3.5" /> বাতিল
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Renew / Extend Verified Badge */}
      {renewModalVendor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl relative border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setRenewModalVendor(null)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  ভেরিফাইড ব্যাজ নবায়ন / মেয়াদ বৃদ্ধি
                </h3>
                <p className="text-xs text-gray-500">
                  {renewModalVendor.storeName || renewModalVendor.shopName}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Option: Extend vs Fresh */}
              {renewModalVendor.expiryDetails?.isVerified && (
                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-2">
                  <span className="text-xs font-bold text-blue-900 block">গণনার ধরণ নির্বাচন করুন:</span>
                  <label className="flex items-center gap-2 text-xs text-blue-800 cursor-pointer">
                    <input
                      type="radio"
                      name="renewOption"
                      checked={renewExtendOption === 'extend'}
                      onChange={() => setRenewExtendOption('extend')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>বর্তমান শেষ তারিখের পর থেকে আরও মেয়াদ বৃদ্ধি (Extend)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-blue-800 cursor-pointer">
                    <input
                      type="radio"
                      name="renewOption"
                      checked={renewExtendOption === 'fresh'}
                      onChange={() => setRenewExtendOption('fresh')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>আজকের তারিখ থেকে নতুন করে দিন গণনা শুরু (Fresh Start)</span>
                  </label>
                </div>
              )}

              {/* Months Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  মেয়াদের সময়সীমা (মাস)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={renewMonths}
                    onChange={(e) => setRenewMonths(Number(e.target.value))}
                    className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-gray-500">মাস</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 6, 12].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRenewMonths(m)}
                      className={`px-2 py-1 text-xs font-semibold rounded-lg border ${
                        renewMonths === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {m}ম
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>নতুন প্যাকেজ মেয়াদ:</span>
                  <span className="font-bold text-gray-900">{renewMonths} মাস</span>
                </div>
                <div className="flex justify-between">
                  <span>ব্যাজের ফি:</span>
                  <span className="font-bold text-gray-900">৳{settings.price}</span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewModalVendor(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleRenewVendor}
                  disabled={isSubmittingRenew}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingRenew ? 'নবায়ন হচ্ছে...' : 'নিশ্চিত করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Manual Grant Badge to Any Registered Vendor */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl relative border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowGrantModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  ভেন্ডরকে ভেরিফাইড ব্যাজ প্রদান
                </h3>
                <p className="text-xs text-gray-500">
                  যে কোনো রেজিস্টার্ড ভেন্ডরকে সরাসরি নির্ধারিত মেয়াদে ভেরিফাইড ব্যাজ দিন।
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Vendor Selection with Search */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  ভেন্ডর নির্বাচন করুন
                </label>
                <input
                  type="text"
                  value={grantSearch}
                  onChange={(e) => setGrantSearch(e.target.value)}
                  placeholder="স্টোরের নাম বা ফোন দিয়ে খুঁজুন..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs mb-2 text-gray-900 focus:ring-2 focus:ring-blue-500"
                />

                <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {grantSearchableVendors.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">কোন ভেন্ডর মেলেনি</div>
                  ) : (
                    grantSearchableVendors.map(v => (
                      <div
                        key={v.id}
                        onClick={() => setGrantSelectedVendorId(v.id)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                          grantSelectedVendorId === v.id ? 'bg-blue-50/90 text-blue-900 font-bold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-gray-900">{v.storeName || v.shopName || 'Store'}</div>
                          <div className="text-[11px] text-gray-500">{v.ownerName || v.name} • {v.phone || v.mobileNumber || 'No Phone'}</div>
                        </div>
                        {grantSelectedVendorId === v.id && (
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Months */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  মেয়াদের সময়কাল (মাস)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={grantMonths}
                    onChange={(e) => setGrantMonths(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-gray-500">মাস</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  {[1, 2, 3, 6, 12].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setGrantMonths(m)}
                      className={`px-2 py-1 text-xs font-semibold rounded-lg border ${
                        grantMonths === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {m}ম
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1 leading-relaxed">
                <div>🗓️ <strong>গণনা শুরু:</strong> আজ ({format(new Date(), 'dd MMM yyyy')}) থেকে দিন গণনা শুরু হবে।</div>
                <div>⏰ <strong>মেয়াদ শেষ:</strong> {format(calculateBadgeExpiry(Date.now(), grantMonths), 'dd MMM yyyy')}-এ ব্যাজ স্বয়ংক্রিয়ভাবে উঠে যাবে।</div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleGrantBadge}
                  disabled={isSubmittingGrant || !grantSelectedVendorId}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingGrant ? 'প্রদান করা হচ্ছে...' : 'ব্যাজ নিশ্চিত করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
