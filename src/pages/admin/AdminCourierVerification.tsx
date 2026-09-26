import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Search, Filter, 
  RefreshCw, ExternalLink, Globe, Truck, Eye, Check, X, ShieldAlert, 
  HelpCircle, ArrowRight, Play, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  fetchApprovedCouriers, 
  fetchVerificationLogs, 
  submitAdminReviewAction, 
  verifyTrackingWithAi,
  type ApprovedCourier, 
  type CourierVerificationRecord 
} from '../../services/courierVerificationClient';
import { rtdbSet, rtdbGet } from '../../lib/rtdb';

export default function AdminCourierVerification() {
  const [activeTab, setActiveTab] = useState<'verifications' | 'manual_review' | 'couriers' | 'simulator'>('verifications');
  const [verifications, setVerifications] = useState<CourierVerificationRecord[]>([]);
  const [couriers, setCouriers] = useState<ApprovedCourier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Inspect Modal
  const [selectedRecord, setSelectedRecord] = useState<CourierVerificationRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Courier Config Editor
  const [editingCourier, setEditingCourier] = useState<ApprovedCourier | null>(null);
  const [showAddCourierModal, setShowAddCourierModal] = useState(false);
  const [newCourierForm, setNewCourierForm] = useState<Partial<ApprovedCourier>>({
    name: '',
    bengaliName: '',
    code: '',
    officialDomains: [''],
    trackingUrlTemplate: '',
    sampleTrackingId: '',
    enabled: true
  });

  // Simulator state
  const [simCourier, setSimCourier] = useState('Steadfast Courier');
  const [simTrackingId, setSimTrackingId] = useState('SF84920194');
  const [simCustomerName, setSimCustomerName] = useState('রহিম উদ্দিন');
  const [simDistrict, setSimDistrict] = useState('Dhaka');
  const [simPhone, setSimPhone] = useState('01712345678');
  const [simCod, setSimCod] = useState('1550');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<CourierVerificationRecord | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logs, courierList] = await Promise.all([
        fetchVerificationLogs(),
        fetchApprovedCouriers()
      ]);
      setVerifications(logs);
      setCouriers(courierList);
    } catch (err) {
      console.error('Error loading verification data:', err);
      toast.error('Failed to load courier verification data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminReview = async (record: CourierVerificationRecord, action: 'approve' | 'reject') => {
    setActionLoading(true);
    try {
      const res = await submitAdminReviewAction({
        verificationId: record.id,
        orderId: record.orderId,
        action,
        notes: reviewNotes || (action === 'approve' ? 'অ্যাডমিন দ্বারা অনুমোদিত' : 'অ্যাডমিন দ্বারা বাতিল'),
        adminName: 'Admin Security Team'
      });

      if (res.success) {
        toast.success(res.message);
        setSelectedRecord(null);
        setReviewNotes('');
        await loadData();
      } else {
        toast.error('অ্যাকশন ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      toast.error(err.message || 'Review action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCouriers = async (updatedList: ApprovedCourier[]) => {
    try {
      await rtdbSet('settings/couriers', updatedList);
      setCouriers(updatedList);
      toast.success('অনুমোদিত কুরিয়ার তালিকা আপডেট করা হয়েছে');
    } catch (err) {
      console.error('Failed to save couriers:', err);
      toast.error('Failed to update couriers');
    }
  };

  const handleToggleCourier = async (code: string) => {
    const updated = couriers.map(c => c.code === code ? { ...c, enabled: !c.enabled } : c);
    await handleSaveCouriers(updated);
  };

  const handleRunSimulator = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimRunning(true);
    setSimResult(null);
    try {
      const res = await verifyTrackingWithAi({
        courierName: simCourier,
        trackingId: simTrackingId.trim(),
        order: {
          orderId: `SIM-${Date.now().toString().slice(-6)}`,
          customerName: simCustomerName,
          district: simDistrict,
          customerPhone: simPhone,
          codAmount: Number(simCod || 0),
          grandTotal: Number(simCod || 0)
        }
      });
      setSimResult(res.record);
      toast.success('সিমুলেশন সম্পন্ন হয়েছে');
    } catch (err: any) {
      toast.error(err.message || 'Simulator failed');
    } finally {
      setSimRunning(false);
    }
  };

  // Filter verifications
  const filteredVerifications = verifications.filter(v => {
    const matchesSearch = 
      (v.orderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.trackingId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.courier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.failureReason || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'verified') return v.verificationResult === 'Verified';
    if (statusFilter === 'manual_review') return v.verificationResult === 'Manual Review Required';
    if (statusFilter === 'failed') return v.verificationResult === 'Verification Failed' || v.verificationResult === 'Invalid Tracking ID';

    return true;
  });

  const manualReviewCount = verifications.filter(v => v.verificationResult === 'Manual Review Required' && !v.adminApproved).length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary-main tracking-wider uppercase mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Anti-Scam Security Center</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Courier Tracking Verification & Anti-Scam</h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-চালিত কুরিয়ার ট্র্যাকিং ও অফিশিয়াল ডোমেইন ভেরিফিকেশন সিস্টেম। ভুয়া কুরিয়ার ও প্রতারণা প্রতিরোধে সার্বক্ষণিক নজরদারি।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">মোট যাচাই সম্পন্ন</span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{verifications.length}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ভেরিফাইড ও সুরক্ষিত</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            {verifications.filter(v => v.verificationResult === 'Verified').length}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ম্যানুয়াল রিভিউ অপেক্ষমাণ</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{manualReviewCount}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">প্রতারণা / বাতিল ব্লকড</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">
            {verifications.filter(v => v.verificationResult === 'Verification Failed' || v.verificationResult === 'Invalid Tracking ID').length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-2">
        <button
          onClick={() => setActiveTab('verifications')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'verifications'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>ভেরিফিকেশন লগ ({verifications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('manual_review')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 relative ${
            activeTab === 'manual_review'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>ম্যানুয়াল রিভিউ কিউ</span>
          {manualReviewCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              {manualReviewCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('couriers')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'couriers'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>অনুমোদিত কুরিয়ার ও ডোমেইন ({couriers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'simulator'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>অ্যান্টি-স্ক্যাম সিমুলেটর</span>
        </button>
      </div>

      {/* Tab 1: Verifications List */}
      {(activeTab === 'verifications' || activeTab === 'manual_review') && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xs border border-slate-200 p-4 sm:p-6 space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="অর্ডার আইডি, ট্র্যাকিং আইডি বা কুরিয়ার খুঁজুন..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-main"
              />
            </div>

            {activeTab === 'verifications' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
                >
                  <option value="all">সব ভেরিফিকেশন</option>
                  <option value="verified">🟢 Verified Only</option>
                  <option value="manual_review">🟠 Manual Review Required</option>
                  <option value="failed">🔴 Failed / Blocked Only</option>
                </select>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-3 px-4">অর্ডার আইডি</th>
                  <th className="py-3 px-4">কুরিয়ার ও ট্র্যাকিং</th>
                  <th className="py-3 px-4">কাস্টমার ও গন্তব্য</th>
                  <th className="py-3 px-4">ফলাফল</th>
                  <th className="py-3 px-4">কনফিডেন্স / কারণ</th>
                  <th className="py-3 px-4">সময়</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activeTab === 'manual_review'
                  ? verifications.filter(v => v.verificationResult === 'Manual Review Required' && !v.adminApproved)
                  : filteredVerifications
                ).map(rec => {
                  const isVerified = rec.verificationResult === 'Verified';
                  const isManual = rec.verificationResult === 'Manual Review Required';
                  const isFailed = !isVerified && !isManual;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        #{rec.orderId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{rec.courier}</div>
                        <div className="font-mono text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                          <span>{rec.trackingId}</span>
                          {rec.officialTrackingUrl && (
                            <a
                              href={rec.officialTrackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-main hover:text-sky-600"
                              title="অফিশিয়াল ওয়েবসাইট পেজ"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{rec.orderSnapshot?.customerName || 'N/A'}</div>
                        <div className="text-[11px] text-slate-500">
                          {rec.orderSnapshot?.district || 'N/A'} • {rec.orderSnapshot?.maskedPhone || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        )}
                        {isManual && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Manual Review
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" /> {rec.verificationResult}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-slate-700 line-clamp-2 text-[11px]">
                          {rec.failureReason || 'সফলভাবে যাচাইকৃত'}
                        </div>
                        {rec.orderMatchConfidence > 0 && (
                          <span className="text-[10px] text-slate-500 mt-0.5 block">
                            ম্যাচ কনফিডেন্স: <strong>{rec.orderMatchConfidence}%</strong>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(rec.verificationTime || rec.createdAt).toLocaleString('bn-BD', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedRecord(rec)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>বিস্তারিত</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredVerifications.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-500 text-xs">
                কোনো ভেরিফিকেশন লগ পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Approved Couriers List & Domains */}
      {activeTab === 'couriers' && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xs border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">অনুমোদিত কুরিয়ার ও অফিশিয়াল ডোমেইন তালিকা</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                শুধুমাত্র এই তালিকায় থাকা কুরিয়ার এবং তাদের অফিশিয়াল ডোমেইন দিয়ে ভেন্ডররা অর্ডার শিপ করতে পারবে।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {couriers.map((c) => (
              <div
                key={c.code}
                className={`p-4 rounded-xl border transition-all ${
                  c.enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary-main/10 text-primary-main flex items-center justify-center font-bold text-sm">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                      <p className="text-xs text-slate-500">{c.bengaliName}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleCourier(c.code)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                      c.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {c.enabled ? 'সক্রিয় (Active)' : 'নিষ্ক্রিয় (Disabled)'}
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">অনুমোদিত অফিশিয়াল ডোমেইন:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.officialDomains.map((dom, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono rounded text-[11px]">
                          {dom}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500">ট্র্যাকিং লিংক টেমপ্লেট:</span>
                    <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 mt-1 break-all">
                      {c.trackingUrlTemplate}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: AI Simulator */}
      {activeTab === 'simulator' && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xs border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Anti-Scam AI ভেরিফিকেশন সিমুলেটর</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              যেকোনো কুরিয়ার ও ট্র্যাকিং আইডি দিয়ে লাইভ অ্যান্টি-স্ক্যাম ভেরিফিকেশন টেস্ট করুন।
            </p>
          </div>

          <form onSubmit={handleRunSimulator} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">কুরিয়ার নির্বাচন করুন</label>
              <select
                value={simCourier}
                onChange={e => setSimCourier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              >
                {couriers.map(c => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ট্র্যাকিং আইডি / Consignment ID</label>
              <input
                type="text"
                required
                value={simTrackingId}
                onChange={e => setSimTrackingId(e.target.value)}
                placeholder="SF84920194"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">পরীক্ষামূলক গ্রাহকের নাম</label>
              <input
                type="text"
                value={simCustomerName}
                onChange={e => setSimCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">জেলা / শহর</label>
              <input
                type="text"
                value={simDistrict}
                onChange={e => setSimDistrict(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">মোবাইল নম্বর</label>
              <input
                type="text"
                value={simPhone}
                onChange={e => setSimPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">COD পরিমাণ (টাকা)</label>
              <input
                type="number"
                value={simCod}
                onChange={e => setSimCod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={simRunning}
                className="px-5 py-2.5 bg-primary-main text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-colors flex items-center gap-2"
              >
                {simRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{simRunning ? 'AI যাচাই চলছে...' : 'সিমুলেশন রান করুন'}</span>
              </button>
            </div>
          </form>

          {simResult && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 max-w-3xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">সিমুলেশন ফলাফল:</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  simResult.verificationResult === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                  simResult.verificationResult === 'Manual Review Required' ? 'bg-amber-100 text-amber-800' :
                  'bg-rose-100 text-rose-800'
                }`}>
                  {simResult.verificationResult}
                </span>
              </div>
              <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200">
                {simResult.failureReason || 'সফলভাবে যাচাইকৃত'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inspect / Review Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">কুরিয়ার ভেরিফিকেশন অডিট রেকর্ড</h3>
                <p className="text-xs text-slate-400">অর্ডার #{selectedRecord.orderId} • {selectedRecord.courier}</p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Status Header */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">যাচাইয়ের ফলাফল:</span>
                  <span className="text-sm font-bold text-slate-900">{selectedRecord.verificationResult}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">বর্তমান স্ট্যাটাস:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.currentStatus}</span>
                </div>
              </div>

              {/* Order Snapshot vs Extracted Courier Data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1">
                    অর্ডারের মূল তথ্য
                  </span>
                  <div>গ্রাহক: <strong className="text-slate-900">{selectedRecord.orderSnapshot?.customerName || 'N/A'}</strong></div>
                  <div>জেলা: <strong className="text-slate-900">{selectedRecord.orderSnapshot?.district || 'N/A'}</strong></div>
                  <div>মোবাইল: <strong className="font-mono text-slate-900">{selectedRecord.orderSnapshot?.maskedPhone || 'N/A'}</strong></div>
                  <div>COD: <strong className="text-slate-900">৳{selectedRecord.orderSnapshot?.codAmount ?? 0}</strong></div>
                </div>

                <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 space-y-1.5">
                  <span className="font-bold text-sky-950 block border-b border-sky-200 pb-1">
                    কুরিয়ার পেজ হতে প্রাপ্ত তথ্য
                  </span>
                  <div>নাম: <strong>{selectedRecord.extractedCourierData?.recipientName || 'অস্পষ্ট / মাস্কড'}</strong></div>
                  <div>জেলা: <strong>{selectedRecord.extractedCourierData?.recipientDistrict || 'অস্পষ্ট / মাস্কড'}</strong></div>
                  <div>ঠিকানা: <strong>{selectedRecord.extractedCourierData?.recipientAddress || 'অস্পষ্ট'}</strong></div>
                  <div>COD: <strong>{selectedRecord.extractedCourierData?.codAmount ? `৳${selectedRecord.extractedCourierData.codAmount}` : 'Not Visible'}</strong></div>
                </div>
              </div>

              {/* Official Link */}
              {selectedRecord.officialTrackingUrl && (
                <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between">
                  <span className="font-mono truncate max-w-sm text-slate-700">{selectedRecord.officialTrackingUrl}</span>
                  <a
                    href={selectedRecord.officialTrackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-main hover:underline font-bold flex items-center gap-1 shrink-0 ml-2"
                  >
                    লাইভ পেজ খুলুন <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* AI explanation */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                <span className="font-bold text-amber-900 block mb-1">AI Anti-Scam বিশ্লেষণ ও কারণ:</span>
                <p className="text-amber-800 leading-relaxed">{selectedRecord.failureReason || 'কোনো অসঙ্গতি পাওয়া যায়নি।'}</p>
              </div>

              {/* Admin Manual Resolution Controls */}
              {selectedRecord.verificationResult === 'Manual Review Required' && !selectedRecord.adminApproved && (
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <span className="font-bold text-slate-900 block">অ্যাডমিন ম্যানুয়াল অ্যাকশন:</span>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="রিভিউ নোট লিখুন (ঐচ্ছিক)..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAdminReview(selectedRecord, 'reject')}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>ট্র্যাকিং বাতিল করুন (Reject)</span>
                    </button>
                    <button
                      onClick={() => handleAdminReview(selectedRecord, 'approve')}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>অনুমোদন ও ভেরিফাই করুন (Approve)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
