import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle, XCircle, ExternalLink, Copy, Check, Truck, 
  User, Phone, MapPin, Store, Package, Clock, ShieldAlert, 
  ShieldCheck, AlertTriangle, AlertCircle, Info, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CourierLinkReviewItem, fetchFullReviewDetails } from '../../services/courierReviewService';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../utils/imageUrl';

interface CourierPendingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewItem: CourierLinkReviewItem | null;
  onApprove: (orderId: string, notes: string) => Promise<void>;
  onReject: (
    orderId: string, 
    reason: string, 
    issueWarning: boolean, 
    warningReason: string, 
    suspendVendor: boolean, 
    suspendReason: string
  ) => Promise<void>;
  actionLoading?: boolean;
}

export const CourierPendingReviewModal: React.FC<CourierPendingReviewModalProps> = ({
  isOpen,
  onClose,
  reviewItem,
  onApprove,
  onReject,
  actionLoading = false
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [enrichedItem, setEnrichedItem] = useState<CourierLinkReviewItem | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // Review action mode: 'idle' | 'approving' | 'rejecting'
  const [actionMode, setActionMode] = useState<'idle' | 'approving' | 'rejecting'>('idle');

  // Form states
  const [approveNotes, setApproveNotes] = useState<string>('অফিশিয়াল কুরিয়ার ট্র্যাকিং লিংক যাচাই করে অনুমোদিত হয়েছে।');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [issueWarning, setIssueWarning] = useState<boolean>(false);
  const [warningReason, setWarningReason] = useState<string>('');
  const [suspendVendor, setSuspendVendor] = useState<boolean>(false);
  const [suspendReason, setSuspendReason] = useState<string>('');

  // Fetch 100% enriched details when modal opens
  useEffect(() => {
    if (!isOpen || !reviewItem) {
      setEnrichedItem(null);
      setActionMode('idle');
      return;
    }

    let isMounted = true;
    setDataLoading(true);
    setEnrichedItem(reviewItem);

    fetchFullReviewDetails(reviewItem.orderId).then((fullData) => {
      if (isMounted && fullData) {
        setEnrichedItem(fullData);
      }
      if (isMounted) setDataLoading(false);
    }).catch(() => {
      if (isMounted) setDataLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, reviewItem?.orderId]);

  if (!isOpen || !reviewItem) return null;

  const item = enrichedItem || reviewItem;

  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    toast.success('কপি করা হয়েছে!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleExecuteApprove = async () => {
    try {
      await onApprove(item.orderId, approveNotes);
      setActionMode('idle');
      onClose();
    } catch (e) {
      // Error handled in parent
    }
  };

  const handleExecuteReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('বাতিল করার কারণ উল্লেখ করুন');
      return;
    }
    try {
      await onReject(
        item.orderId, 
        rejectReason.trim(), 
        issueWarning, 
        warningReason.trim(), 
        suspendVendor, 
        suspendReason.trim()
      );
      setActionMode('idle');
      onClose();
    } catch (e) {
      // Error handled in parent
    }
  };

  const cleanUrl = item.trackingUrl?.startsWith('http') 
    ? item.trackingUrl 
    : `https://${item.trackingUrl}`;

  // Quick reject reason presets
  const rejectPresets = [
    'ভুল বা কাজ করছে না এমন ট্র্যাকিং লিংক দেওয়া হয়েছে।',
    'কুরিয়ার সিস্টেমে এই ট্র্যাকিং নম্বরটি পাওয়া যায়নি।',
    'কুরিয়ারের নাম এবং ট্র্যাকিং লিংকের মিল নেই।',
    'অন্য কোনো পার্সেলের ট্র্যাকিং লিংক শেয়ার করা হয়েছে।',
    'সরাসরি পার্সেল ট্র্যাকিং পেইজের লিংক দিন, হোমপেইজ নয়।'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================= */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-5 sm:px-6 py-4.5 shrink-0 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  কুরিয়ার ট্র্যাকিং রিভিউ (Courier Link Review)
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 shadow-xs animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>🟡 Pending — Admin Review</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                অর্ডার #{item.orderNumber || item.orderId} • ভেন্ডরের দেওয়া কুরিয়ার ট্র্যাকিং লিংক যাচাই করুন
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* SCROLLABLE MODAL BODY */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* 1. TOP ANCHOR: COURIER TRACKING LINK VERIFICATION BOX */}
          <div className="bg-gradient-to-br from-sky-50 via-indigo-50/40 to-blue-50/60 rounded-2xl p-4 sm:p-5 border-2 border-sky-200/80 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-200/60">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-xl bg-primary-main text-white font-black text-xs sm:text-sm tracking-wide shadow-xs flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  <span>{item.courierName || 'কুরিয়ার সার্ভিস'}</span>
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  কুরিয়ার নির্বাচন
                </span>
              </div>

              {/* Tracking / Consignment ID */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Tracking / Consignment ID:</span>
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-sky-200 shadow-2xs font-mono font-black text-xs text-slate-900">
                  <span>{item.trackingId || 'N/A'}</span>
                  <button
                    onClick={() => handleCopy(item.trackingId, 'trackingId')}
                    className="p-1 hover:text-primary-main text-slate-400 transition-colors"
                    title="Copy Tracking ID"
                  >
                    {copiedField === 'trackingId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Vendor-এর দেওয়া Courier Tracking Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Vendor-এর দেওয়া Courier Tracking Link:</span>
                <span className="text-[11px] text-sky-700 font-medium">নিচের বাটনে ক্লিক করে সরাসরি লিংকটি খুলুন</span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-sky-300 font-mono text-xs text-sky-950 break-all shadow-inner">
                  <span className="truncate">{item.trackingUrl}</span>
                  <button
                    onClick={() => handleCopy(item.trackingUrl, 'trackingUrl')}
                    className="shrink-0 p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary-main transition-colors"
                    title="Copy Tracking Link"
                  >
                    {copiedField === 'trackingUrl' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-primary-main hover:from-sky-700 hover:to-primary-dark text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm hover:shadow transition-all shrink-0 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>লিংক খুলে পরীক্ষা করুন (Open Link)</span>
                </a>
              </div>
              <p className="text-[11px] text-slate-600 flex items-center gap-1 pt-0.5">
                <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>লিংকটি ব্রাউজারের নতুন ট্যাবে খুলে নিশ্চিত হোন যে এটি উক্ত অর্ডারের সঠিক ট্র্যাকিং পেইজ।</span>
              </p>
            </div>
          </div>

          {/* 2. ORDER INFORMATION & CUSTOMER DETAILS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* LEFT: CUSTOMER INFORMATION */}
            <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-main" />
                  <span>Customer Information (গ্রাহকের তথ্য)</span>
                </h4>
                <span className="text-[11px] font-semibold text-slate-500">ক্রেতা</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Customer Name */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Customer Name:</span>
                  <span className="font-bold text-slate-900 text-right">{item.customerName || 'N/A'}</span>
                </div>

                {/* Customer Phone Number */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Customer Phone:</span>
                  <div className="flex items-center gap-1.5">
                    {item.customerPhone ? (
                      <>
                        <a 
                          href={`tel:${item.customerPhone}`}
                          className="font-bold font-mono text-primary-main hover:underline"
                        >
                          {item.customerPhone}
                        </a>
                        <button
                          onClick={() => handleCopy(item.customerPhone || '', 'customerPhone')}
                          className="p-1 hover:text-primary-main text-slate-400 transition-colors"
                          title="Copy Phone"
                        >
                          {copiedField === 'customerPhone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </div>
                </div>

                {/* District */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">District (জেলা):</span>
                  <span className="font-bold text-slate-800 text-right">{item.district || 'N/A'}</span>
                </div>

                {/* Thana */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Thana (থানা/উপজেলা):</span>
                  <span className="font-bold text-slate-800 text-right">{item.thana || 'N/A'}</span>
                </div>

                {/* Area */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Area (এলাকা):</span>
                  <span className="font-bold text-slate-800 text-right">{item.area || 'N/A'}</span>
                </div>

                {/* Full Delivery Address */}
                <div className="pt-2 border-t border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Full Delivery Address:</span>
                    </span>
                    {item.fullDeliveryAddress && (
                      <button
                        onClick={() => handleCopy(item.fullDeliveryAddress || '', 'address')}
                        className="p-0.5 text-slate-400 hover:text-primary-main"
                        title="Copy Address"
                      >
                        {copiedField === 'address' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                  <p className="text-slate-800 font-medium text-xs leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                    {item.fullDeliveryAddress || item.customerAddress || 'পূর্ণাঙ্গ ঠিকানা পাওয়া যায়নি'}
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT: VENDOR & ORDER INFORMATION */}
            <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-600" />
                  <span>Vendor & Order Details (ভেন্ডর ও অর্ডার)</span>
                </h4>
                <span className="text-[11px] font-semibold text-slate-500">সারসংক্ষেপ</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Order ID */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Order ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900">#{item.orderNumber || item.orderId}</span>
                    <button
                      onClick={() => handleCopy(item.orderNumber || item.orderId, 'orderId')}
                      className="p-1 hover:text-primary-main text-slate-400 transition-colors"
                      title="Copy Order ID"
                    >
                      {copiedField === 'orderId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Order Amount */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Order Amount:</span>
                  <span className="font-extrabold text-sm text-emerald-700">
                    ৳{Number(item.totalAmount || 0).toLocaleString()}
                  </span>
                </div>

                {/* Vendor Name */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Vendor Name:</span>
                  <span className="font-bold text-slate-900 text-right">{item.vendorName || 'N/A'}</span>
                </div>

                {/* Shop Name */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Shop Name:</span>
                  <span className="font-bold text-slate-900 text-right">{item.vendorShopName || 'N/A'}</span>
                </div>

                {/* Vendor ID */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-medium">Vendor ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-700 truncate max-w-[140px]">{item.vendorId}</span>
                    <button
                      onClick={() => handleCopy(item.vendorId, 'vendorId')}
                      className="p-1 hover:text-primary-main text-slate-400 transition-colors"
                      title="Copy Vendor ID"
                    >
                      {copiedField === 'vendorId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Vendor Warning Count */}
                <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-200/80">
                  <span className="text-slate-500 font-medium">Vendor Warnings:</span>
                  <div>
                    {Number(item.vendorWarningCount || 0) > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        ⚠️ {item.vendorWarningCount} Warning(s)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✅ Clean Record (0)
                      </span>
                    )}
                  </div>
                </div>

                {/* Submission Time */}
                <div className="flex items-start justify-between gap-2 text-slate-400 text-[11px]">
                  <span>Submitted At:</span>
                  <span>{item.submittedAt ? new Date(item.submittedAt).toLocaleString('en-US') : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. ORDER PRODUCTS (Order-এর Product) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <span>Order-এর Product ({item.items?.length || item.itemsCount || 1} টি আইটেম)</span>
              </h4>
              <span className="text-xs font-bold text-slate-600">
                মোট মূল্য: ৳{Number(item.totalAmount || 0).toLocaleString()}
              </span>
            </div>

            {Array.isArray(item.items) && item.items.length > 0 ? (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {item.items.map((prod, pIdx) => {
                  const pImg = formatDirectImageUrl(prod.image || prod.thumbnail || '') || PLACEHOLDER_PRODUCT_IMAGE;
                  return (
                    <div key={prod.id || pIdx} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={pImg} 
                          alt={prod.name || prod.title || 'Product'} 
                          onError={handleProductImageError}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {prod.name || prod.title || 'অজ্ঞাত পণ্য'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                            <span>পরিমাণ: <strong className="text-slate-800">x{prod.quantity || 1}</strong></span>
                            {prod.variant && <span>ভ্যারিয়েন্ট: <strong>{prod.variant}</strong></span>}
                            {prod.color && <span>রং: <strong>{prod.color}</strong></span>}
                            {prod.size && <span>সাইজ: <strong>{prod.size}</strong></span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-900">
                          ৳{((Number(prod.price) || 0) * (Number(prod.quantity) || 1)).toLocaleString()}
                        </span>
                        {Number(prod.quantity) > 1 && (
                          <p className="text-[10px] text-slate-400">
                            (৳{Number(prod.price || 0).toLocaleString()} / পিস)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700">
                <span className="font-semibold">{item.itemsSummary || 'পণ্য বিস্তারিত'}</span>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 4. ADMIN REVIEW ACTIONS (APPROVE / REJECT) */}
          {/* ========================================================= */}
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
            
            {actionMode === 'idle' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900">
                    অ্যাডমিন রিভিউ সিদ্ধান্ত নিন (Admin Review Decision):
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    ট্র্যাকিং লিংক পরীক্ষা করে সিদ্ধান্ত নিন
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Approve Trigger Button */}
                  <button
                    onClick={() => setActionMode('approving')}
                    className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow transition-all group"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform" />
                    <span>✅ Approve (অনুমোদন করুন)</span>
                  </button>

                  {/* Reject Trigger Button */}
                  <button
                    onClick={() => setActionMode('rejecting')}
                    className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow transition-all group"
                  >
                    <XCircle className="w-5 h-5 text-rose-200 group-hover:scale-110 transition-transform" />
                    <span>❌ Reject (বাতিল করুন)</span>
                  </button>
                </div>
              </div>
            )}

            {/* APPROVE FORM VIEW */}
            {actionMode === 'approving' && (
              <div className="space-y-4 p-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span>কুরিয়ার ট্র্যাকিং অনুমোদন করুন (Approve Tracking)</span>
                  </h4>
                  <button
                    onClick={() => setActionMode('idle')}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold"
                  >
                    পেছনে যান
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-emerald-900 bg-white/80 p-3 rounded-xl border border-emerald-200">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>অনুমোদনের পর স্বয়ংক্রিয় কার্যক্রম:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-800 pl-1">
                    <li>অর্ডারের কুরিয়ার ট্র্যাকিং <strong>Verified</strong> হবে।</li>
                    <li>অর্ডার স্ট্যাটাস পরিবর্তিত হয়ে <strong>Shipped</strong> হবে এবং লাইভ ট্র্যাকিং চালু হবে।</li>
                    <li>ভেন্ডর ও গ্রাহক উভয়ের কাছে অটোমেটিক নোটিফিকেশন পৌঁছে যাবে।</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    অনুমোদন নোট / মন্তব্য (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    placeholder="অফিশিয়াল কুরিয়ার ট্র্যাকিং লিংক যাচাই করে অনুমোদিত হয়েছে।"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionMode('idle')}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteApprove}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
                  >
                    {actionLoading ? (
                      <span>অনুমোদন হচ্ছে...</span>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>নিশ্চিত অনুমোদন করুন (Approve Now)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* REJECT FORM VIEW */}
            {actionMode === 'rejecting' && (
              <div className="space-y-4 p-4 bg-rose-50/80 border-2 border-rose-300 rounded-2xl animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                  <h4 className="text-sm font-black text-rose-950 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>কুরিয়ার ট্র্যাকিং লিংক বাতিল করুন (Reject Tracking)</span>
                  </h4>
                  <button
                    onClick={() => setActionMode('idle')}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold"
                  >
                    পেছনে যান
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-rose-900 bg-white/80 p-3 rounded-xl border border-rose-200">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>বাতিল করার ফলাফল:</span>
                  </p>
                  <p className="text-[11px] text-rose-800">
                    ভেন্ডরের কাছে নোটিফিকেশন যাবে এবং সঠিক কুরিয়ার ট্র্যাকিং লিংক দেওয়ার অনুরোধ করবে। অর্ডারটি পুনরায় Accepted অবস্থায় থাকবে।
                  </p>
                </div>

                {/* Preset quick reasons */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    বাতিল করার কারণ দ্রুত নির্বাচন করুন:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {rejectPresets.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setRejectReason(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border text-left transition-colors ${
                          rejectReason === preset 
                            ? 'bg-rose-600 text-white border-rose-600 font-bold' 
                            : 'bg-white text-slate-700 border-slate-300 hover:border-rose-300'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom reject reason */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    সুনির্দিষ্ট কারণ লিখুন <span className="text-rose-500">*</span>:
                  </label>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="ভেন্ডরের কাছে পাঠানোর জন্য বাতিলের সঠিক কারণ লিখুন..."
                    className="w-full text-xs px-3 py-2 bg-white border border-rose-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden"
                    required
                  />
                </div>

                {/* Optional Warning */}
                <div className="pt-2 border-t border-rose-200 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={issueWarning}
                      onChange={(e) => setIssueWarning(e.target.checked)}
                      className="w-4 h-4 text-rose-600 border-rose-300 rounded focus:ring-rose-500"
                    />
                    <span>⚠️ ভেন্ডরকে অফিশিয়াল Warning (সতর্কবার্তা) দিন</span>
                  </label>
                  {issueWarning && (
                    <input
                      type="text"
                      value={warningReason}
                      onChange={(e) => setWarningReason(e.target.value)}
                      placeholder="সতর্কবার্তা দেওয়ার কারণ (যেমন: বারবার ভুল ট্র্যাকিং লিংক প্রদান)"
                      className="w-full text-xs px-3 py-2 bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                    />
                  )}
                </div>

                {/* Optional Suspend */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-rose-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={suspendVendor}
                      onChange={(e) => setSuspendVendor(e.target.checked)}
                      className="w-4 h-4 text-rose-600 border-rose-300 rounded focus:ring-rose-500"
                    />
                    <span>⛔ ভেন্ডর অ্যাকাউন্ট অবিলম্বে Suspend করুন (যদি ভুয়া বা প্রতারণামূলক হয়)</span>
                  </label>
                  {suspendVendor && (
                    <input
                      type="text"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="অ্যাকাউন্ট স্থগিত করার কারণ"
                      className="w-full text-xs px-3 py-2 bg-white border border-rose-400 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden"
                    />
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionMode('idle')}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteReject}
                    disabled={actionLoading || !rejectReason.trim()}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
                  >
                    {actionLoading ? (
                      <span>বাতিল হচ্ছে...</span>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        <span>বাতিল ও নোটিফিকেশন পাঠান (Reject Now)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL FOOTER */}
        {/* ========================================================= */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-100 border-t border-slate-200 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>অ্যাডমিন রিভিউ সম্পন্ন না হওয়া পর্যন্ত ট্র্যাকিং গ্রাহকের কাছে ভেরিফাইড হিসেবে প্রদর্শিত হবে না।</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            বন্ধ করুন (Close)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourierPendingReviewModal;
