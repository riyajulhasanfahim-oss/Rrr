import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbGet, rtdbSet, rtdbList } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Wallet, TrendingUp, TrendingDown, Clock, Activity, CreditCard, ArrowRight, FileText, ShieldCheck, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { checkAndAutoReleaseVendorPayout, getOrCreateVendorWallet } from '../../../services/vendorPayoutService';

export default function VendorWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('All Time');

  useEffect(() => {
    fetchWalletAndTransactions();
  }, [user]);

  const fetchWalletAndTransactions = async () => {
    if (!user) return;
    try {
      // 0. Auto-check and release any eligible vendor orders
      try {
        const pendingOrders = await rtdbList<any>('vendor_orders', (o) => o.vendorId === user.uid && (o.vendorPayoutStatus === 'Held' || o.vendorPayoutStatus === 'Release Pending'));
        for (const oDoc of pendingOrders) {
          const oData = { id: oDoc.id, ...oDoc.data };
          await checkAndAutoReleaseVendorPayout(oData);
        }
      } catch (e) {
        console.warn('Auto release check error', e);
      }

      // 1. Fetch Wallet
      const walletData = await getOrCreateVendorWallet(user.uid);
      setWallet(walletData);

      // 2. Fetch Transactions
      const txList = await rtdbList<any>('wallet_transactions', (tx) => tx.vendorId === user.uid);
      const items = txList.map(doc => ({ id: doc.id, ...doc.data })) as any[];
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTransactions(items);
      
    } catch (error) {
      console.error("Error fetching wallet data from RTDB", error);
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch(type) {
      case 'Income': return <TrendingUp className="w-4 h-4" />;
      case 'Withdraw': return <TrendingDown className="w-4 h-4" />;
      case 'Refund': return <Clock className="w-4 h-4" />;
      case 'Adjustment': return <Activity className="w-4 h-4" />;
      case 'Commission': return <TrendingDown className="w-4 h-4" />;
      case 'Bonus': return <TrendingUp className="w-4 h-4" />;
      default: return <CreditCard className="w-4 h-4" />;
    }
  };

  const getTransactionColor = (type: string, status: string) => {
    if (status === 'Failed' || status === 'Rejected') return 'text-red-500 bg-red-100 ';
    if (status === 'Pending') return 'text-yellow-500 bg-yellow-100 ';
    
    switch(type) {
      case 'Income': return 'text-green-600 bg-green-100 ';
      case 'Bonus': return 'text-green-600 bg-green-100 ';
      case 'Withdraw': return 'text-blue-600 bg-blue-100 ';
      case 'Refund': return 'text-gray-600 bg-gray-100 ';
      case 'Commission': return 'text-red-600 bg-red-100 ';
      case 'Adjustment': return 'text-indigo-600 bg-indigo-100 ';
      default: return 'text-gray-600 bg-gray-100 ';
    }
  };

  const getAmountColor = (type: string, status: string) => {
    if (status === 'Failed' || status === 'Rejected') return 'text-gray-500 line-through';
    if (['Income', 'Bonus', 'Refund'].includes(type)) return 'text-green-600 ';
    if (['Withdraw', 'Commission'].includes(type)) return 'text-red-600 ';
    return 'text-gray-900 ';
  };

  const filteredTransactions = transactions.filter(tx => {
    let matchesDate = true;
    if (dateFilter !== 'All Time' && tx.createdAt) {
      const txDate = new Date(tx.createdAt);
      const now = new Date();
      if (dateFilter === 'Today') {
        matchesDate = txDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'This Week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = txDate >= weekAgo;
      } else if (dateFilter === 'This Month') {
        matchesDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      }
    }
    return matchesDate;
  });

  const getEarningsForPeriod = (period: 'Today' | 'Weekly' | 'Monthly') => {
    const now = new Date();
    let startTime = 0;
    
    if (period === 'Today') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (period === 'Weekly') {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
    } else if (period === 'Monthly') {
      startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    return transactions
      .filter(tx => tx.type === 'Income' && tx.status === 'Completed' && tx.createdAt >= startTime)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  };

  const generateReport = () => {
    // Generate CSV
    const headers = ['Transaction Type', 'Date', 'Amount', 'Status', 'Description'];
    const csvData = filteredTransactions.map(tx => [
      tx.type,
      new Date(tx.createdAt).toLocaleDateString(),
      tx.amount,
      tx.status,
      tx.description || ''
    ].join(','));
    
    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `wallet_report_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report downloaded');
  };

  if (loading) {
    return (
      <VendorLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200  rounded w-1/4"></div>
          <div className="grid grid-cols-1 md lg gap-6">
            <div className="h-32 bg-gray-200  rounded-2xl"></div>
            <div className="h-32 bg-gray-200  rounded-2xl"></div>
            <div className="h-32 bg-gray-200  rounded-2xl"></div>
            <div className="h-32 bg-gray-200  rounded-2xl"></div>
          </div>
          <div className="h-96 bg-gray-200  rounded-2xl"></div>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary-main" />
            <span>Wallet</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Manage your earnings and withdraw funds.</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button 
            onClick={generateReport}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white border border-gray-200 text-gray-700 text-xs sm:text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1 shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span> Report
          </button>
          <Link 
            to="/vendor/withdraw"
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-main text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-sky-600 transition-colors shadow-sm shrink-0"
          >
            Withdraw
          </Link>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-5">
        <div className="bg-gradient-to-br from-primary-main to-primary-dark rounded-xl p-3 sm:p-4 text-white shadow-sm relative overflow-hidden col-span-2 sm:col-span-1">
          <p className="text-sky-100 text-[10px] sm:text-xs font-medium mb-0.5">Available Balance</p>
          <h3 className="text-xl sm:text-2xl font-black">৳{(wallet?.balance || 0).toFixed(2)}</h3>
          <Link to="/vendor/withdraw" className="mt-1.5 inline-flex items-center text-[11px] font-semibold text-white/90 hover:text-white">
            Withdraw Now <ArrowRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
        
        <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mb-0.5">Pending</p>
          <h3 className="text-base sm:text-xl font-bold text-gray-900">৳{(wallet?.pendingBalance || 0).toFixed(2)}</h3>
        </div>

        <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mb-0.5">Lifetime Earned</p>
          <h3 className="text-base sm:text-xl font-bold text-gray-900">৳{(wallet?.lifetimeEarnings || 0).toFixed(2)}</h3>
        </div>

        <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mb-0.5">This Month</p>
          <h3 className="text-base sm:text-xl font-bold text-green-600">৳{getEarningsForPeriod('Monthly').toFixed(2)}</h3>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="p-2.5 sm:p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/70">
          <h2 className="text-xs sm:text-sm font-bold text-gray-900">Transactions</h2>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-gray-300 rounded-xl bg-white text-gray-900 px-2 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20"
          >
            <option value="All Time">All Time</option>
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
          </select>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-gray-100">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">No transactions found</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div key={tx.id} className="p-3 flex items-center justify-between gap-2.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getTransactionColor(tx.type, tx.status)}`}>
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{tx.type}</p>
                    <p className="text-[10px] text-gray-400">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-black block ${getAmountColor(tx.type, tx.status)}`}>
                    {['Income', 'Bonus', 'Refund'].includes(tx.type) ? '+' : '-'}৳{Math.abs(tx.amount || 0).toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-semibold ${
                    tx.status === 'Completed' || tx.status === 'Approved' ? 'text-green-600' :
                    tx.status === 'Failed' || tx.status === 'Rejected' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {tx.status || 'Pending'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <CreditCard className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm font-medium">No transactions found</p>
                      <p className="text-xs mt-0.5">You don't have any transactions for this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="bg-white hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getTransactionColor(tx.type, tx.status)}`}>
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{tx.type}</p>
                          <p className="text-[11px] text-gray-500">{tx.description || tx.transactionId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-gray-900">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '-'}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString() : '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-bold ${getAmountColor(tx.type, tx.status)}`}>
                        {['Income', 'Bonus', 'Refund'].includes(tx.type) ? '+' : '-'}৳{Math.abs(tx.amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 inline-flex text-[11px] leading-4 font-semibold rounded-full ${
                        tx.status === 'Completed' || tx.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                        tx.status === 'Failed' || tx.status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {tx.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </VendorLayout>
  );
}
