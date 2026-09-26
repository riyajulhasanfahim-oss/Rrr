import React, { useEffect, useState, useMemo } from 'react';
import { 
  Coins, Search, Filter, RefreshCw, CheckCircle2, Clock, AlertTriangle, 
  ExternalLink, Eye, ArrowUpDown, ChevronRight, X, Phone, MapPin, 
  Store, User, ShieldCheck, Download, Calendar, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  getAllVendorsPlatformFees, 
  getVendorPlatformFeeRecords, 
  reconcileAllDeliveredCodOrders,
  VendorPlatformFeeSummary, 
  PlatformFeeRecord,
  formatAddress
} from '../../services/platformFeeService';
import { rtdbSubscribe } from '../../lib/rtdb';

const safeStr = (val: any, fallback = ''): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val.trim() || fallback;
  if (typeof val === 'object') {
    return formatAddress(val);
  }
  return String(val);
};

const safeDate = (val: any): string => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : new Date(String(val));
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'dd MMM yyyy, hh:mm a');
  } catch {
    return 'N/A';
  }
};

export default function AdminPlatformFee() {
  const [summaries, setSummaries] = useState<VendorPlatformFeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDue, setFilterDue] = useState<'all' | 'due' | 'paid'>('all');
  const [selectedVendor, setSelectedVendor] = useState<VendorPlatformFeeSummary | null>(null);
  const [vendorRecords, setVendorRecords] = useState<PlatformFeeRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    fetchData();

    // Realtime database listener for platform fee summaries
    const unsub = rtdbSubscribe('vendor_platform_fees', () => {
      fetchData();
    });

    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getAllVendorsPlatformFees();
      setSummaries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching platform fee summaries:', err);
      toast.error('প্ল্যাটফর্ম ফি লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    try {
      setReconciling(true);
      const res = await reconcileAllDeliveredCodOrders();
      toast.success(`সফলভাবে সিঙ্ক সম্পন্ন! মোট ${res.processedCount} টি COD ডেলিভারি প্রসেস করা হয়েছে।`);
      await fetchData();
    } catch (err) {
      console.error('Error reconciling platform fees:', err);
      toast.error('সিঙ্ক করতে সমস্যা হয়েছে');
    } finally {
      setReconciling(false);
    }
  };

  const handleViewVendorDetails = async (vendor: VendorPlatformFeeSummary) => {
    setSelectedVendor(vendor);
    try {
      setLoadingRecords(true);
      const records = await getVendorPlatformFeeRecords(vendor.vendorId);
      setVendorRecords(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error('Error loading vendor records:', err);
      toast.error('অর্ডারের বিবরণ লোড করা যায়নি');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Metrics Calculation
  const metrics = useMemo(() => {
    let totalAccrued = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalCodOrders = 0;
    let vendorsWithDue = 0;

    const list = Array.isArray(summaries) ? summaries : [];
    for (const s of list) {
      if (!s) continue;
      totalAccrued += Number(s.totalPlatformFee || 0);
      totalPaid += Number(s.paidPlatformFee || 0);
      totalDue += Number(s.duePlatformFee || 0);
      totalCodOrders += Number(s.totalDeliveredCodOrders || 0);
      if (Number(s.duePlatformFee || 0) > 0) {
        vendorsWithDue++;
      }
    }

    return {
      totalAccrued,
      totalPaid,
      totalDue,
      totalCodOrders,
      vendorsWithDue,
      totalVendors: list.length
    };
  }, [summaries]);

  // Filter & Search
  const filteredSummaries = useMemo(() => {
    if (!Array.isArray(summaries)) return [];
    return summaries.filter(s => {
      if (!s) return false;
      const vName = safeStr(s.vendorName).toLowerCase();
      const sName = safeStr(s.storeName).toLowerCase();
      const mobile = safeStr(s.mobileNumber);
      const vId = safeStr(s.vendorId).toLowerCase();
      const addr = safeStr(s.address).toLowerCase();
      const term = (searchTerm || '').trim().toLowerCase();

      const matchesSearch = 
        !term ||
        vName.includes(term) ||
        sName.includes(term) ||
        mobile.includes(term) ||
        vId.includes(term) ||
        addr.includes(term);

      if (!matchesSearch) return false;

      if (filterDue === 'due') {
        return (Number(s.duePlatformFee) || 0) > 0;
      }
      if (filterDue === 'paid') {
        return (Number(s.duePlatformFee) || 0) === 0 && (Number(s.totalPlatformFee) || 0) > 0;
      }
      return true;
    });
  }, [summaries, searchTerm, filterDue]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Platform Fee Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                শুধুমাত্র সফল Cash on Delivery (COD) অর্ডারের ভেন্ডার প্ল্যাটফর্ম ফি হিসাব ও বকেয়া ট্র্যাকিং
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleReconcile}
            disabled={reconciling || loading}
            title="ডাটাবেজের পূর্বের সব সফল COD অর্ডারের প্ল্যাটফর্ম ফি এক ক্লিকে সিঙ্ক করুন"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${reconciling ? 'animate-spin' : ''}`} />
            <span>{reconciling ? 'সিঙ্ক হচ্ছে...' : 'হিস্ট্রি সিঙ্ক (Reconcile)'}</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 bg-primary-main hover:bg-sky-600 text-white rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Due */}
        <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">বর্তমান মোট বকেয়া</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            ৳{metrics.totalDue.toLocaleString()}
          </div>
          <div className="text-xs text-rose-600 font-medium mt-1">
            {metrics.vendorsWithDue} জন ভেন্ডারের বকেয়া রয়েছে
          </div>
        </div>

        {/* Total Collected / Paid */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">মোট সংগৃহীত / পেইড ফি</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            ৳{metrics.totalPaid.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">
            সরাসরি bKash/Nagad/Rocket দ্বারা যাচাইকৃত
          </div>
        </div>

        {/* Total Accrued */}
        <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">মোট প্ল্যাটফর্ম ফি</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Coins className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            ৳{metrics.totalAccrued.toLocaleString()}
          </div>
          <div className="text-xs text-blue-600 font-medium mt-1">
            প্রতি সফল COD অর্ডারে নির্ধারিত ৳৫ ফি
          </div>
        </div>

        {/* Successful COD Orders */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">মোট সফল COD ডেলিভারি</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {metrics.totalCodOrders.toLocaleString()} টি
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            মোট {metrics.totalVendors} জন নিবন্ধিত ভেন্ডার
          </div>
        </div>
      </div>

      {/* Rules Information Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 text-amber-900">
        <h3 className="font-bold text-sm flex items-center gap-2 text-amber-950">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          প্ল্যাটফর্ম ফি পলিসি ও স্বয়ংক্রিয় নিয়মাবলী:
        </h3>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mt-2.5 text-xs text-amber-800">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span><strong>শুধুমাত্র Cash on Delivery (COD)</strong> অর্ডার সফলভাবে Delivered/Completed হলেই প্রতি অর্ডারে ৳৫ বকেয়া জমা হয়।</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span><strong>অনলাইন পেমেন্ট ও ওয়ালেট</strong> অর্ডারে কোনো প্ল্যাটফর্ম ফি ধার্য হয় না (বকেয়া হবে না)।</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span><strong>বাতিল/রিটার্ন/ফেইল্ড</strong> অর্ডারে ফি যোগ হবে না। ডুপ্লিকেট প্রটেকশন থাকায় এক অর্ডারে একাধিকবার ফি যোগ হতে পারে না।</span>
          </li>
        </ul>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ভেন্ডারের নাম, শপ, ফোন, ভেন্ডার আইডি বা ঠিকানা খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterDue('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterDue === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            সকল ভেন্ডার ({summaries.length})
          </button>
          <button
            onClick={() => setFilterDue('due')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterDue === 'due'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            বকেয়া আছে ({summaries.filter(s => (s.duePlatformFee || 0) > 0).length})
          </button>
          <button
            onClick={() => setFilterDue('paid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterDue === 'paid'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            পরিশোধিত ({summaries.filter(s => (s.duePlatformFee || 0) === 0 && (s.totalPlatformFee || 0) > 0).length})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">ভেন্ডার ও শপ</th>
                <th className="py-3.5 px-4">মোবাইল ও ঠিকানা</th>
                <th className="py-3.5 px-4 text-center">সফল COD ডেলিভারি</th>
                <th className="py-3.5 px-4 text-right">মোট প্ল্যাটফর্ম ফি</th>
                <th className="py-3.5 px-4 text-right">পরিশোধিত</th>
                <th className="py-3.5 px-4 text-right">বর্তমান বকেয়া</th>
                <th className="py-3.5 px-4 text-center">স্ট্যাটাস</th>
                <th className="py-3.5 px-4 text-center">একশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-main" />
                    ডাটা লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    কোনো ভেন্ডারের প্ল্যাটফর্ম ফি তথ্য পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((vendor) => {
                  const hasDue = (vendor.duePlatformFee || 0) > 0;
                  const isZeroActivity = (vendor.totalDeliveredCodOrders || 0) === 0;

                  return (
                    <tr key={vendor.vendorId} className="hover:bg-slate-50/70 transition-colors">
                      {/* Vendor & Store */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{safeStr(vendor.storeName, 'Shop')}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{safeStr(vendor.vendorName, 'Vendor')}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          ID: {safeStr(vendor.vendorId)}
                        </div>
                      </td>

                      {/* Contact & Address */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{safeStr(vendor.mobileNumber, 'N/A')}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-start gap-1.5 mt-1 line-clamp-2 max-w-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="truncate">{safeStr(vendor.address, 'N/A')}</span>
                        </div>
                      </td>

                      {/* Successful COD Orders Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {Number(vendor.totalDeliveredCodOrders || 0)} টি
                        </span>
                      </td>

                      {/* Total Platform Fee */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                        ৳{Number(vendor.totalPlatformFee || 0).toLocaleString()}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3.5 px-4 text-right font-medium text-emerald-600">
                        ৳{Number(vendor.paidPlatformFee || 0).toLocaleString()}
                      </td>

                      {/* Current Due */}
                      <td className="py-3.5 px-4 text-right">
                        <span className={`text-sm font-black ${hasDue ? 'text-rose-600' : 'text-slate-600'}`}>
                          ৳{Number(vendor.duePlatformFee || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {hasDue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            বকেয়া আছে
                          </span>
                        ) : isZeroActivity ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                            কোনো ডেলিভারি নেই
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            পরিশোধিত
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleViewVendorDetails(vendor)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>বিস্তারিত</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Order Details Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    {safeStr(selectedVendor.storeName, 'Shop')} — প্ল্যাটফর্ম ফি বিবরণ
                  </h3>
                  <p className="text-xs text-slate-500">
                    ভেন্ডার: {safeStr(selectedVendor.vendorName, 'Vendor')} | ফোন: {safeStr(selectedVendor.mobileNumber, 'N/A')} | আইডি: {safeStr(selectedVendor.vendorId)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVendor(null)}
                className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Sub-header Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-white border-b border-slate-100 text-center">
              <div className="bg-slate-50 p-2.5 rounded-xl">
                <span className="text-[11px] text-slate-500 font-bold block uppercase">সফল COD ডেলিভারি</span>
                <span className="text-lg font-black text-slate-900">{Number(selectedVendor.totalDeliveredCodOrders || 0)} টি</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl">
                <span className="text-[11px] text-slate-500 font-bold block uppercase">মোট প্ল্যাটফর্ম ফি</span>
                <span className="text-lg font-black text-slate-900">৳{Number(selectedVendor.totalPlatformFee || 0).toLocaleString()}</span>
              </div>
              <div className="bg-emerald-50/80 p-2.5 rounded-xl">
                <span className="text-[11px] text-emerald-700 font-bold block uppercase">পরিশোধিত</span>
                <span className="text-lg font-black text-emerald-600">৳{Number(selectedVendor.paidPlatformFee || 0).toLocaleString()}</span>
              </div>
              <div className="bg-rose-50/80 p-2.5 rounded-xl">
                <span className="text-[11px] text-rose-700 font-bold block uppercase">বর্তমান বকেয়া</span>
                <span className="text-lg font-black text-rose-600">৳{Number(selectedVendor.duePlatformFee || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Modal Body: Records List */}
            <div className="p-5 flex-1 overflow-y-auto">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3">
                সংশ্লিষ্ট COD অর্ডারের তালিকা (৳৫ প্রতি ডেলিভারি)
              </h4>

              {loadingRecords ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-main" />
                  অর্ডারের রেকর্ড লোড হচ্ছে...
                </div>
              ) : vendorRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl">
                  এই ভেন্ডারের এখনও কোনো সফল COD অর্ডারের প্ল্যাটফর্ম ফি রেকর্ড নেই।
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-3.5">অর্ডার আইডি</th>
                        <th className="py-3 px-3.5">কাস্টমার</th>
                        <th className="py-3 px-3.5">ডেলিভারির তারিখ</th>
                        <th className="py-3 px-3.5">পেমেন্ট মেথড</th>
                        <th className="py-3 px-3.5 text-right">প্ল্যাটফর্ম ফি</th>
                        <th className="py-3 px-3.5 text-center">স্ট্যাটাস</th>
                        <th className="py-3 px-3.5">পরিশোধ ট্রানজেকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendorRecords.map((record) => {
                        const isPaid = record.status === 'paid';
                        return (
                          <tr key={record.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                              #{safeStr(record.orderId).substring(0, 10)}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-700">
                              <div>{safeStr(record.customerName, 'Customer')}</div>
                              <div className="text-[10px] text-slate-400">{safeStr(record.customerPhone)}</div>
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-500">
                              {safeDate(record.deliveredAt || record.createdAt)}
                            </td>
                            <td className="py-2.5 px-3.5 uppercase font-bold text-slate-600">
                              {safeStr(record.paymentMethod, 'COD')}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-black text-slate-900">
                              ৳{Number(record.feeAmount || 5)}
                            </td>
                            <td className="py-2.5 px-3.5 text-center">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> পরিশোধিত
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  বকেয়া
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5">
                              {record.paymentTrxId ? (
                                <div>
                                  <span className="font-mono font-bold text-slate-900 uppercase">
                                    {safeStr(record.paymentTrxId)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block uppercase">
                                    ({safeStr(record.paymentMethodUsed, 'Payment')})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">এখনও পরিশোধিত নয়</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedVendor(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs sm:text-sm cursor-pointer transition-colors"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
