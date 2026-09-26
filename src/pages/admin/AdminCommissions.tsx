import React, { useEffect, useState } from 'react';
import { rtdbList, rtdbUpdate } from '../../lib/rtdb';
import { Search, Filter, CheckCircle, XCircle, CreditCard, Clock, Activity, Edit } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const formatCommissionDate = (val: any) => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'MMM d, yyyy');
  } catch {
    return 'N/A';
  }
};

export default function AdminCommissions() {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    fetchCommissions();
  }, []);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      // Fetch both reseller transactions and user referral transactions from RTDB
      const [resellerTxList, referralTxList] = await Promise.all([
        rtdbList<any>('reseller_transactions').catch(() => []),
        rtdbList<any>('user_referral_transactions').catch(() => [])
      ]);
      
      const rTx = resellerTxList.map(({ id, data }) => ({
        id,
        type: 'Reseller Commission',
        ...data,
        createdAt: data?.createdAt || Date.now()
      }));
      const refTx = referralTxList.map(({ id, data }) => ({
        id,
        type: 'Referral Commission',
        ...data,
        createdAt: data?.createdAt || Date.now()
      }));
      
      const allTx = [...rTx, ...refTx].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      setCommissions(allTx);
    } catch (error) {
      console.error('Error fetching commissions from RTDB:', error);
      toast.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  };

  const updateCommissionStatus = async (tx: any, newStatus: string) => {
    try {
      const collectionName = tx.type === 'Reseller Commission' ? 'reseller_transactions' : 'user_referral_transactions';
      await rtdbUpdate(`${collectionName}/${tx.id}`, { status: newStatus, updatedAt: Date.now() });
      toast.success(`Commission marked as ${newStatus}`);
      fetchCommissions();
    } catch (error) {
      console.error('Error updating commission:', error);
      toast.error('Failed to update commission');
    }
  };

  const filtered = commissions.filter(c => {
    const matchSearch = 
      (c.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.orderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.resellerId || c.referrerId || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchStatus = filterStatus === 'All' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Approved': return 'bg-emerald-100 text-emerald-700';
      case 'Paid': return 'bg-blue-100 text-blue-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commission Management</h1>
          <p className="text-sm text-slate-500 mt-1">Review and manage reseller and leadership commissions.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Pending Commissions</p>
          <p className="text-xl font-bold text-amber-600">
            ৳{commissions.filter(c => c.status === 'Pending').reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Approved Commissions</p>
          <p className="text-xl font-bold text-emerald-600">
            ৳{commissions.filter(c => c.status === 'Approved').reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Paid Commissions</p>
          <p className="text-xl font-bold text-blue-600">
            ৳{commissions.filter(c => c.status === 'Paid').reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Commission</p>
          <p className="text-xl font-bold text-slate-900">
            ৳{commissions.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by order ID, customer or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['All', 'Pending', 'Approved', 'Paid', 'Rejected'].map(status => (
              <button 
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors \${filterStatus === status ? 'bg-primary-main text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
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
                <th className="px-6 py-4 font-semibold">User/Reseller ID</th>
                <th className="px-6 py-4 font-semibold">Order Details</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main mx-auto"></div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No commissions found.</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors bg-white">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {c.resellerId ? c.resellerId.substring(0, 8) : c.referrerId ? c.referrerId.substring(0, 8) : 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{c.orderId || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{c.customerName || 'Unknown Customer'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                        <Activity className="w-3.5 h-3.5 text-slate-400" /> {c.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      ৳{c.amount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {formatCommissionDate(c.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold \${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {c.status === 'Pending' && (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => updateCommissionStatus(c, 'Approved')}
                            className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-xs font-semibold transition-colors"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => updateCommissionStatus(c, 'Rejected')}
                            className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-semibold transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {c.status === 'Approved' && (
                        <button 
                          onClick={() => updateCommissionStatus(c, 'Paid')}
                          className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-semibold transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                      {c.status !== 'Pending' && c.status !== 'Approved' && (
                        <span className="text-xs text-slate-400">No action</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
