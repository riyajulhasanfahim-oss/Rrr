import React, { useEffect, useState } from 'react';
import { rtdbGet, rtdbList, rtdbUpdate, rtdbPush, rtdbSubscribe } from '../../lib/rtdb';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Search, Filter, CheckCircle, XCircle, Clock, Banknote, Edit, CreditCard, Activity, AlertCircle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { notifyVendorWithdrawalUpdate } from '../../services/vendorNotificationService';
import { executeResellerWalletTransaction } from '../../services/resellerWalletService';
import { ResellerTransactionType } from '../../types/resellerWallet';

const formatWithdrawalDate = (val: any, pattern: string) => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : format(d, pattern);
  } catch {
    return 'N/A';
  }
};

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  
  // Modal State
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const [wList, reqList] = await Promise.all([
        rtdbList<any>('withdrawals').catch(() => []),
        rtdbList<any>('withdraw_requests').catch(() => [])
      ]);

      const map = new Map<string, any>();
      [...wList, ...reqList].forEach(({ id, data }) => {
        if (id && !map.has(id)) {
          const paymentMethod = data?.paymentMethod || data?.method || 'bKash';
          const paymentNumber = data?.paymentNumber || data?.mobileNumber || data?.accountNumber || 'N/A';
          const accountType = data?.accountType || (data?.vendorId ? 'Vendor' : 'Wallet');
          const userName = data?.userName || data?.accountName || data?.vendorName || (data?.vendorId ? 'Vendor' : 'User');
          const amount = Number(data?.amount) || 0;
          const fee = Number(data?.fee) || 0;
          const netAmount = Number(data?.netAmount) || amount;

          map.set(id, {
            id,
            ...data,
            paymentMethod,
            paymentNumber,
            accountType,
            userName,
            amount,
            fee,
            netAmount,
            status: data?.status || 'Pending',
            createdAt: data?.createdAt || data?.date || Date.now()
          });
        }
      });

      const wData = Array.from(map.values()).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      setWithdrawals(wData);
    } catch (error) {
      console.error('Error fetching withdrawals from RTDB:', error);
      toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();

    // Subscribe to realtime updates
    const unsubWithdrawals = rtdbSubscribe('withdrawals', () => {
      fetchWithdrawals();
    });
    const unsubRequests = rtdbSubscribe('withdraw_requests', () => {
      fetchWithdrawals();
    });

    return () => {
      if (unsubWithdrawals) unsubWithdrawals();
      if (unsubRequests) unsubRequests();
    };
  }, []);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedWithdrawal) return;
    try {
      setIsProcessing(true);
      const now = Date.now();
      
      const updateData: any = { 
        status: newStatus,
        adminNote: adminNote || selectedWithdrawal.adminNote || '',
        updatedAt: now
      };

      if (newStatus === 'Paid') {
        if (!transactionRef && selectedWithdrawal.status !== 'Paid') {
          toast.error('Transaction reference is required for paid withdrawals');
          setIsProcessing(false);
          return;
        }
        updateData.transactionRef = transactionRef || selectedWithdrawal.transactionRef || '';
        updateData.processedAt = now;
      }

      // Handle Balance Logic in RTDB
      const isCurrentlyFinal = ['Paid', 'Rejected', 'Cancelled'].includes(selectedWithdrawal.status);
      const targetUserId = selectedWithdrawal.userId || selectedWithdrawal.vendorId;
      
      if (!isCurrentlyFinal && targetUserId) {
        try {
          const amount = Number(selectedWithdrawal.amount) || 0;

          if (selectedWithdrawal.accountType === 'Vendor' || selectedWithdrawal.vendorId) {
            // Vendor Wallet handling
            const vendorId = selectedWithdrawal.vendorId || selectedWithdrawal.userId;
            const vWallet = await rtdbGet<any>(`vendor_wallet/${vendorId}`) || {};
            const curBal = Number(vWallet.balance) || 0;
            const curPending = Number(vWallet.pendingBalance) || 0;
            const curTotalWithdrawn = Number(vWallet.totalWithdrawn) || 0;

            if (newStatus === 'Rejected' || newStatus === 'Cancelled') {
              await rtdbUpdate(`vendor_wallet/${vendorId}`, {
                balance: curBal + amount,
                pendingBalance: Math.max(0, curPending - amount),
                updatedAt: now
              });
            } else if (newStatus === 'Paid') {
              await rtdbUpdate(`vendor_wallet/${vendorId}`, {
                pendingBalance: Math.max(0, curPending - amount),
                totalWithdrawn: curTotalWithdrawn + amount,
                updatedAt: now
              });
            }
          } else if (selectedWithdrawal.accountType === 'Reseller') {
            // Reseller User handling (Atomic RTDB transaction on reseller_wallet)
            if (newStatus === 'Rejected' || newStatus === 'Cancelled') {
              await executeResellerWalletTransaction({
                resellerId: targetUserId,
                userId: targetUserId,
                orderId: selectedWithdrawal.id,
                amount,
                type: ResellerTransactionType.WITHDRAWAL_REFUND,
                status: 'REVERSED',
                description: `Withdrawal #${selectedWithdrawal.id} ${newStatus} refund`
              });
            } else if (newStatus === 'Paid') {
              await executeResellerWalletTransaction({
                resellerId: targetUserId,
                userId: targetUserId,
                orderId: selectedWithdrawal.id,
                amount,
                type: ResellerTransactionType.WITHDRAWAL_PAID,
                status: 'COMPLETED',
                description: `Withdrawal #${selectedWithdrawal.id} paid`
              });
            }
          } else {
            // General User / Wallet handling
            const uData = await rtdbGet<any>(`users/${targetUserId}`) || {};
            const curWallet = typeof uData.wallet === 'number' ? uData.wallet : (typeof uData.balance === 'number' ? uData.balance : (Number(uData.walletBalance) || 0));
            const curHeld = Number(uData.heldBalance) || 0;
            const curTotal = Number(uData.totalWithdrawn) || 0;

            if (newStatus === 'Rejected' || newStatus === 'Cancelled') {
              await rtdbUpdate(`users/${targetUserId}`, {
                wallet: curWallet + amount,
                balance: curWallet + amount,
                walletBalance: curWallet + amount,
                heldBalance: Math.max(0, curHeld - amount),
                updatedAt: now
              });
              // Firestore users sync
              try {
                await updateDoc(doc(db, 'users', targetUserId), {
                  wallet: curWallet + amount,
                  balance: curWallet + amount,
                  updatedAt: now
                });
              } catch (fErr) {}
            } else if (newStatus === 'Paid') {
              await rtdbUpdate(`users/${targetUserId}`, {
                heldBalance: Math.max(0, curHeld - amount),
                totalWithdrawn: curTotal + amount,
                updatedAt: now
              });
            }
          }
        } catch (balErr) {
          console.warn('Error adjusting balance in RTDB:', balErr);
        }
      }

      // Update RTDB 'withdrawals'
      await rtdbUpdate(`withdrawals/${selectedWithdrawal.id}`, updateData);

      // Also update 'withdraw_requests' if present
      await rtdbUpdate(`withdraw_requests/${selectedWithdrawal.id}`, updateData).catch(() => {});

      // Also sync Firestore document if present
      try {
        const fireDoc = await getDoc(doc(db, 'withdrawals', selectedWithdrawal.id));
        if (fireDoc.exists()) {
          await updateDoc(doc(db, 'withdrawals', selectedWithdrawal.id), updateData);
        }
      } catch (fErr) {}
      
      // Notify Vendor or User
      const targetVendorId = selectedWithdrawal.vendorId || (selectedWithdrawal.accountType === 'Vendor' ? selectedWithdrawal.userId : null);
      if (targetVendorId) {
        notifyVendorWithdrawalUpdate(
          targetVendorId,
          Number(selectedWithdrawal.amount) || 0,
          newStatus,
          adminNote || selectedWithdrawal.adminNote
        ).catch(e => console.warn('Vendor withdrawal notif failed:', e));
      } else if (targetUserId) {
        // Customer / User RTDB notification
        rtdbPush(`notifications/${targetUserId}`, {
          title: `Withdrawal ${newStatus}`,
          message: `আপনার ৳${selectedWithdrawal.amount} উত্তোলনের রিকোয়েস্ট (${selectedWithdrawal.paymentMethod}) ${newStatus === 'Approved' ? 'অনুমোদিত' : newStatus === 'Paid' ? 'পরিশোধিত' : newStatus === 'Rejected' ? 'বাতিল' : newStatus} হয়েছে।${adminNote ? ` নোট: ${adminNote}` : ''}`,
          type: 'withdrawal',
          status: newStatus,
          amount: selectedWithdrawal.amount,
          read: false,
          createdAt: Date.now()
        }).catch(() => {});
      }

      toast.success(`উইথড্র স্ট্যাটাস "${newStatus}" করা হয়েছে`);
      setSelectedWithdrawal(null);
      fetchWithdrawals();
    } catch (error) {
      console.error('Error updating withdrawal:', error);
      toast.error('উইথড্র স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = withdrawals.filter(w => {
    const matchSearch = 
      (w.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.paymentNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.userId || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchStatus = filterStatus === 'All' || w.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Processing': return 'bg-blue-100 text-blue-700';
      case 'Approved': return 'bg-emerald-100 text-emerald-700';
      case 'Paid': return 'bg-purple-100 text-purple-700';
      case 'Rejected': 
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Withdrawals Management</h1>
          <p className="text-sm text-slate-500 mt-1">Review and process bKash, Nagad, Rocket, and Bank withdrawals (Processing time: 24 Hours).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Requests</p>
          <p className="text-xl font-bold text-slate-900">{withdrawals.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Pending</p>
          <p className="text-xl font-bold text-amber-600">
            {withdrawals.filter(w => w.status === 'Pending').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Processing</p>
          <p className="text-xl font-bold text-blue-600">
            {withdrawals.filter(w => w.status === 'Processing').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Approved</p>
          <p className="text-xl font-bold text-emerald-600">
            {withdrawals.filter(w => w.status === 'Approved').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Paid Amount</p>
          <p className="text-xl font-bold text-purple-600">
            ৳{withdrawals.filter(w => w.status === 'Paid').reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Rejected</p>
          <p className="text-xl font-bold text-red-600">
            {withdrawals.filter(w => w.status === 'Rejected').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by ID, User, or Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['All', 'Pending', 'Processing', 'Approved', 'Paid', 'Rejected', 'Cancelled'].map(status => (
              <button 
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-primary-main text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold">User Details</th>
                <th className="px-6 py-4 font-semibold">Method & Number</th>
                <th className="px-6 py-4 font-semibold">Amount Info</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main mx-auto"></div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No withdrawals found.</td>
                </tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 transition-colors bg-white">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{w.userName || 'Unknown'}</div>
                      <div className="text-xs text-slate-500 mt-1 flex gap-2">
                        <span className="font-mono">{w.userId?.substring(0,8)}</span>
                        <span className="bg-slate-100 px-1.5 rounded">{w.accountType || 'Wallet'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          w.paymentMethod === 'bKash' ? 'bg-pink-100 text-pink-700' :
                          w.paymentMethod === 'Nagad' ? 'bg-orange-100 text-orange-700' :
                          w.paymentMethod === 'Rocket' ? 'bg-purple-100 text-purple-700' :
                          w.paymentMethod === 'Upay' ? 'bg-sky-100 text-sky-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {w.paymentMethod || 'Unknown'}
                        </span>
                        <span className="font-mono font-medium text-slate-900">{w.paymentNumber || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">৳{w.amount?.toLocaleString()}</div>
                      <div className="text-xs text-slate-500">Fee: ৳{w.fee || 0} • Net: ৳{w.netAmount || w.amount}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <div className="text-sm">
                        {formatWithdrawalDate(w.createdAt, 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs">
                        {formatWithdrawalDate(w.createdAt, 'h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(w.status)}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedWithdrawal(w);
                          setAdminNote(w.adminNote || '');
                          setTransactionRef(w.transactionRef || '');
                        }}
                        className="px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-primary-main hover:text-white rounded-lg text-xs font-semibold transition-colors border border-slate-200 hover:border-primary-main inline-flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" /> Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Management Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary-main" /> Manage Withdrawal
              </h3>
              <button 
                onClick={() => setSelectedWithdrawal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                disabled={isProcessing}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(selectedWithdrawal.status)}`}>
                    {selectedWithdrawal.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Request ID</p>
                  <p className="font-mono text-sm text-slate-900">{selectedWithdrawal.id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">User Name</p>
                  <p className="font-medium text-slate-900">{selectedWithdrawal.userName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">User ID</p>
                  <p className="font-mono text-sm text-slate-900">{selectedWithdrawal.userId}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-slate-700">Payment Details</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    selectedWithdrawal.paymentMethod === 'bKash' ? 'bg-pink-100 text-pink-700' :
                    selectedWithdrawal.paymentMethod === 'Nagad' ? 'bg-orange-100 text-orange-700' :
                    selectedWithdrawal.paymentMethod === 'Rocket' ? 'bg-purple-100 text-purple-700' :
                    selectedWithdrawal.paymentMethod === 'Upay' ? 'bg-sky-100 text-sky-800' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {selectedWithdrawal.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500">Account Number</span>
                  <span className="font-mono font-bold text-slate-900 text-lg">{selectedWithdrawal.paymentNumber}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-500">Requested Amount</span>
                  <span className="font-medium text-slate-900">৳{selectedWithdrawal.amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500">Processing Fee</span>
                  <span className="font-medium text-red-500">-৳{selectedWithdrawal.fee || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-sm font-bold text-slate-700">Net Payable Amount</span>
                  <span className="font-bold text-emerald-600 text-xl">৳{(selectedWithdrawal.netAmount || selectedWithdrawal.amount)?.toLocaleString()}</span>
                </div>

                {selectedWithdrawal.bankName && (
                  <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Bank:</span>
                      <span className="ml-1 font-semibold text-slate-800">{selectedWithdrawal.bankName}</span>
                    </div>
                    {selectedWithdrawal.branchName && (
                      <div>
                        <span className="text-slate-500">Branch:</span>
                        <span className="ml-1 font-semibold text-slate-800">{selectedWithdrawal.branchName}</span>
                      </div>
                    )}
                    {selectedWithdrawal.routingNumber && (
                      <div>
                        <span className="text-slate-500">Routing:</span>
                        <span className="ml-1 font-semibold text-slate-800">{selectedWithdrawal.routingNumber}</span>
                      </div>
                    )}
                  </div>
                )}

                {(selectedWithdrawal.notes || selectedWithdrawal.note) && (
                  <div className="mt-2 text-xs text-slate-600 bg-white p-2 rounded border border-slate-200">
                    <span className="font-semibold text-slate-700">User Note:</span> {selectedWithdrawal.notes || selectedWithdrawal.note}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Note (Reason for rejection, etc.)</label>
                  <textarea 
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Add an internal note or reason for the user..."
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                    rows={2}
                  />
                </div>
                
                {['Approved', 'Processing', 'Paid'].includes(selectedWithdrawal.status) || selectedWithdrawal.status === 'Pending' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      Transaction Reference <span className="text-xs font-normal text-slate-500">(Required for Paid)</span>
                    </label>
                    <input 
                      type="text" 
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="e.g. 9X32F8JKL1"
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main font-mono text-sm"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 justify-end">
              {/* Action Buttons based on status */}
              {selectedWithdrawal.status === 'Pending' && (
                <>
                  <button onClick={() => handleUpdateStatus('Rejected')} disabled={isProcessing} className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-semibold transition-colors">Reject</button>
                  <button onClick={() => handleUpdateStatus('Processing')} disabled={isProcessing} className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-semibold transition-colors">Mark Processing</button>
                  <button onClick={() => handleUpdateStatus('Approved')} disabled={isProcessing} className="px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-semibold transition-colors">Approve</button>
                </>
              )}
              
              {selectedWithdrawal.status === 'Processing' && (
                <>
                  <button onClick={() => handleUpdateStatus('Rejected')} disabled={isProcessing} className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-semibold transition-colors">Reject</button>
                  <button onClick={() => handleUpdateStatus('Approved')} disabled={isProcessing} className="px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-semibold transition-colors">Approve</button>
                </>
              )}

              {selectedWithdrawal.status === 'Approved' && (
                <>
                  <button onClick={() => handleUpdateStatus('Rejected')} disabled={isProcessing} className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-semibold transition-colors">Reject</button>
                  <button onClick={() => handleUpdateStatus('Paid')} disabled={isProcessing} className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors shadow-sm">Mark as Paid</button>
                </>
              )}

              {/* Final States only allow updating notes/ref */}
              {['Paid', 'Rejected', 'Cancelled'].includes(selectedWithdrawal.status) && (
                <button onClick={() => handleUpdateStatus(selectedWithdrawal.status)} disabled={isProcessing} className="px-4 py-2 bg-primary-main text-white hover:bg-primary-dark rounded-lg text-sm font-semibold transition-colors shadow-sm">
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
