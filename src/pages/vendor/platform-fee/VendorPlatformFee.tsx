import React, { useState, useEffect } from 'react';
import { 
  Coins, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight, 
  CreditCard, ShieldCheck, Clock, ExternalLink, Copy, Check, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../../context/AuthContext';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  getVendorPlatformFee, 
  getVendorPlatformFeeRecords, 
  payVendorPlatformFeeWithTrxId,
  VendorPlatformFeeSummary, 
  PlatformFeeRecord 
} from '../../../services/platformFeeService';
import PaymentMethodSelectionModal from '../../../components/checkout/PaymentMethodSelectionModal';
import BkashPaymentModal from '../../../components/checkout/BkashPaymentModal';
import NagadPaymentModal from '../../../components/checkout/NagadPaymentModal';
import RocketPaymentModal from '../../../components/checkout/RocketPaymentModal';
import UpayPaymentModal from '../../../components/checkout/UpayPaymentModal';

export default function VendorPlatformFee() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<VendorPlatformFeeSummary | null>(null);
  const [records, setRecords] = useState<PlatformFeeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment states
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<'bkash' | 'nagad' | 'rocket' | 'upay' | null>(null);
  const [showBkashModal, setShowBkashModal] = useState(false);
  const [showNagadModal, setShowNagadModal] = useState(false);
  const [showRocketModal, setShowRocketModal] = useState(false);
  const [showUpayModal, setShowUpayModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const vendorId = user?.uid || '';

  const loadData = async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      const [sum, recs] = await Promise.all([
        getVendorPlatformFee(vendorId),
        getVendorPlatformFeeRecords(vendorId)
      ]);
      setSummary(sum);
      setRecords(recs);
    } catch (err) {
      console.error('Error loading vendor platform fee data:', err);
      toast.error('প্ল্যাটফর্ম ফি তথ্য লোড করা যায়নি');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const dueAmount = summary?.duePlatformFee || 0;
  const invoiceId = `FEE-INV-${vendorId.substring(0, 5).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  const handleStartPayment = () => {
    if (dueAmount <= 0) {
      toast.success('আপনার কোনো বকেয়া প্ল্যাটফর্ম ফি নেই!');
      return;
    }
    setErrorMessage('');
    setShowMethodModal(true);
  };

  const handleVerifyTrxId = async (transactionId: string, channel: 'bkash' | 'nagad' | 'rocket' | 'upay') => {
    if (!vendorId || dueAmount <= 0) return;
    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await payVendorPlatformFeeWithTrxId(
        vendorId,
        dueAmount,
        transactionId,
        channel,
        undefined,
        invoiceId
      );

      if (res.success) {
        toast.success(res.message, { duration: 5000 });
        // Close all modals
        setShowBkashModal(false);
        setShowNagadModal(false);
        setShowRocketModal(false);
        setShowUpayModal(false);
        setShowMethodModal(false);
        setErrorMessage('');
        // Refresh data
        await loadData();
      } else {
        setErrorMessage(res.message);
        toast.error(res.message, { duration: 6000 });
      }
    } catch (err: any) {
      console.error('Error verifying platform fee payment:', err);
      const msg = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
      setErrorMessage(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <VendorLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  বকেয়া প্ল্যাটফর্ম ফি (Platform Fee)
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  সফল Cash on Delivery (COD) অর্ডারের ধার্যকৃত প্ল্যাটফর্ম ফি ট্র্যাকিং ও পরিশোধ
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {dueAmount > 0 && (
              <button
                onClick={handleStartPayment}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>বকেয়া পরিশোধ করুন (৳{dueAmount})</span>
              </button>
            )}

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Due Notice Card if has due */}
        {dueAmount > 0 ? (
          <div className="bg-gradient-to-r from-rose-50 to-orange-50 border-2 border-rose-200/80 rounded-2xl p-5 sm:p-6 text-slate-900 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/30">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-700">
                    জরুরি বকেয়া ফি বিজ্ঞপ্তি
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                    আপনার বর্তমান বকেয়া প্ল্যাটফর্ম ফি: ৳{dueAmount}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
                    সফলভাবে ডেলিভারিকৃত COD অর্ডারের প্ল্যাটফর্ম ফি bKash, Nagad বা Rocket-এর মাধ্যমে পরিশোধ করুন। ট্রানজেকশন আইডি প্রদান করার পর স্বয়ংক্রিয়ভাবে ভেরিফাই হয়ে বকেয়া তালিকা থেকে বাদ যাবে।
                  </p>
                </div>
              </div>

              <button
                onClick={handleStartPayment}
                className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-md shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <span>৳{dueAmount} পরিশোধ করুন</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 text-emerald-900">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">আপনার কোনো বকেয়া প্ল্যাটফর্ম ফি নেই!</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                সব সফল COD অর্ডারের প্ল্যাটফর্ম ফি সম্পূর্ণ পরিশোধিত রয়েছে। পরবর্তীতে নতুন COD অর্ডার Delivered হলে স্বয়ংক্রিয়ভাবে এখানে যুক্ত হবে।
              </p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Current Due */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">বর্তমান বকেয়া ফি</span>
              <Coins className="w-4.5 h-4.5 text-rose-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              <span className={dueAmount > 0 ? 'text-rose-600' : 'text-slate-900'}>
                ৳{dueAmount}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {dueAmount > 0 ? 'অনলাইন গেটওয়ে দ্বারা পরিশোধযোগ্য' : 'সব পরিশোধিত'}
            </div>
          </div>

          {/* Successful COD Orders */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">সফল COD ডেলিভারি</span>
              <ShieldCheck className="w-4.5 h-4.5 text-blue-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {summary?.totalDeliveredCodOrders || 0} টি
            </div>
            <div className="text-xs text-slate-500 mt-1">
              শুধু ডেলিভারিকৃত Cash on Delivery অর্ডার
            </div>
          </div>

          {/* Total Accrued */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">মোট ধার্যকৃত ফি</span>
              <CreditCard className="w-4.5 h-4.5 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              ৳{summary?.totalPlatformFee || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              প্রতি সফল COD ডেলিভারিতে ৳৫
            </div>
          </div>

          {/* Total Paid */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">মোট পরিশোধিত ফি</span>
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
            </div>
            <div className="text-3xl font-black text-emerald-600 mt-2">
              ৳{summary?.paidPlatformFee || 0}
            </div>
            <div className="text-xs text-emerald-700 mt-1">
              যাচাইকৃত সফল পেমেন্ট
            </div>
          </div>
        </div>

        {/* Detailed Orders Breakdown Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                সফল Cash on Delivery (COD) অর্ডারের তালিকা ও ফি বিবরণ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                প্রতিটি সফল ডেলিভারিকৃত COD অর্ডারে নির্ধারিত ৳৫ প্ল্যাটফর্ম ফি যুক্ত হয়
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              মোট {records.length} টি রেকর্ড
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">অর্ডার আইডি</th>
                  <th className="py-3.5 px-4">কাস্টমার তথ্য</th>
                  <th className="py-3.5 px-4">ডেলিভারির তারিখ</th>
                  <th className="py-3.5 px-4">পেমেন্ট মেথড</th>
                  <th className="py-3.5 px-4 text-right">প্ল্যাটফর্ম ফি</th>
                  <th className="py-3.5 px-4 text-center">স্ট্যাটাস</th>
                  <th className="py-3.5 px-4">পেমেন্ট ট্রানজেকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-main" />
                      লোড হচ্ছে...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      আপনার এখনও কোনো সফল COD অর্ডারের প্ল্যাটফর্ম ফি রেকর্ড নেই।
                    </td>
                  </tr>
                ) : (
                  records.map((record) => {
                    const isPaid = record.status === 'paid';
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          #{record.orderId?.substring(0, 10)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          <div className="font-semibold">{record.customerName || 'Customer'}</div>
                          <div className="text-xs text-slate-400">{record.customerPhone}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {record.deliveredAt ? format(new Date(record.deliveredAt), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase">
                            {record.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900">
                          ৳{record.feeAmount || 5}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> পরিশোধিত
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              বকেয়া
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {record.paymentTrxId ? (
                            <div>
                              <span className="font-mono font-bold text-slate-900 uppercase">
                                {record.paymentTrxId}
                              </span>
                              <span className="text-[10px] text-slate-400 block uppercase">
                                ({record.paymentMethodUsed || 'Verified'})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">এখনও পরিশোধিত নয়</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 1. Payment Method Selection Modal */}
        <PaymentMethodSelectionModal
          isOpen={showMethodModal}
          onClose={() => setShowMethodModal(false)}
          amount={dueAmount}
          paymentType="vendor_platform_fee"
          invoiceId={invoiceId}
          isSubmitting={isVerifying}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          onConfirmPayment={(channel) => {
            setShowMethodModal(false);
            setErrorMessage('');
            if (channel === 'bkash') setShowBkashModal(true);
            else if (channel === 'nagad') setShowNagadModal(true);
            else if (channel === 'rocket') setShowRocketModal(true);
            else if (channel === 'upay') setShowUpayModal(true);
          }}
        />

        {/* 2. bKash Modal */}
        <BkashPaymentModal
          isOpen={showBkashModal}
          onClose={() => {
            setShowBkashModal(false);
            setErrorMessage('');
          }}
          onBack={() => {
            setShowBkashModal(false);
            setShowMethodModal(true);
          }}
          amount={dueAmount}
          invoiceId={invoiceId}
          bkashNumber="01864670673"
          isSubmitting={isVerifying}
          errorMessage={errorMessage}
          onVerify={(trxId) => handleVerifyTrxId(trxId, 'bkash')}
        />

        {/* 3. Nagad Modal */}
        <NagadPaymentModal
          isOpen={showNagadModal}
          onClose={() => {
            setShowNagadModal(false);
            setErrorMessage('');
          }}
          onBack={() => {
            setShowNagadModal(false);
            setShowMethodModal(true);
          }}
          amount={dueAmount}
          invoiceId={invoiceId}
          nagadNumber="01864670673"
          isSubmitting={isVerifying}
          errorMessage={errorMessage}
          onVerify={(trxId) => handleVerifyTrxId(trxId, 'nagad')}
        />

        {/* 4. Rocket Modal */}
        <RocketPaymentModal
          isOpen={showRocketModal}
          onClose={() => {
            setShowRocketModal(false);
            setErrorMessage('');
          }}
          onBack={() => {
            setShowRocketModal(false);
            setShowMethodModal(true);
          }}
          amount={dueAmount}
          invoiceId={invoiceId}
          rocketNumber="01864670673"
          isSubmitting={isVerifying}
          errorMessage={errorMessage}
          onVerify={(trxId) => handleVerifyTrxId(trxId, 'rocket')}
        />

        {/* 5. Upay Modal */}
        <UpayPaymentModal
          isOpen={showUpayModal}
          onClose={() => {
            setShowUpayModal(false);
            setErrorMessage('');
          }}
          onBack={() => {
            setShowUpayModal(false);
            setShowMethodModal(true);
          }}
          amount={dueAmount}
          invoiceId={invoiceId}
          upayNumber="01864670673"
          isSubmitting={isVerifying}
          errorMessage={errorMessage}
          onVerify={(trxId) => handleVerifyTrxId(trxId, 'upay')}
        />
      </div>
    </VendorLayout>
  );
}
