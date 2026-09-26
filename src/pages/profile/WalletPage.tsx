import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { Wallet, ArrowLeft, ArrowUpRight, ArrowDownRight, ArrowDownLeft, Clock, Plus, Building2, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { rtdbList } from '../../lib/rtdb';
import toast from 'react-hot-toast';

export default function WalletPage() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletInfo, setWalletInfo] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch user wallet document
        const wDoc = await getDoc(doc(db, 'user_wallet', user.uid));
        if (wDoc.exists()) {
          setWalletInfo(wDoc.data());
        }

        // Fetch withdrawals (RTDB + Firestore)
        let withdrawalList: any[] = [];
        try {
          const [rtdbWList, fireSnap] = await Promise.all([
            rtdbList<any>('withdrawals', (w) => w.userId === user.uid).catch(() => []),
            getDocs(query(collection(db, 'withdrawals'), where('userId', '==', user.uid))).catch(() => ({ docs: [] } as any))
          ]);
          const rtdbMapped = rtdbWList.map(item => ({ id: item.id, txType: 'withdrawal', ...item.data }));
          const fireMapped = fireSnap.docs.map((d: any) => ({ id: d.id, txType: 'withdrawal', ...d.data() }));
          const map = new Map<string, any>();
          [...rtdbMapped, ...fireMapped].forEach(item => {
            if (item.id && !map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          withdrawalList = Array.from(map.values());
        } catch (wErr) {
          console.warn('Withdrawals fetch error:', wErr);
        }

        // Fetch RTDB wallet transactions (Refunds, Credits)
        let rtdbTxList: any[] = [];
        try {
          const list = await rtdbList<any>('wallet_transactions', (t) => t.userId === user.uid);
          rtdbTxList = list.map(item => ({
            id: item.id,
            txType: 'rtdb_wallet',
            ...item.data
          }));
        } catch (rErr) {
          console.warn('RTDB wallet_transactions fetch error:', rErr);
        }

        // Combine and sort descending by timestamp/createdAt
        const combined = [...withdrawalList, ...rtdbTxList];
        combined.sort((a, b) => {
          const timeA = a.timestamp || a.createdAt || 0;
          const timeB = b.timestamp || b.createdAt || 0;
          return timeB - timeA;
        });

        setTransactions(combined);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (!userData) return null;

  const lockedBonus = walletInfo?.lockedBonus || 0;
  const eligibleSales = walletInfo?.bonusEligibleSales || 0;
  const isBonusLocked = lockedBonus > 0 && eligibleSales < 10;
  const baseBalance = userData.wallet || 0;
  
  // If bonus is locked, we show it in the balance but we might want to warn the user
  const displayBalance = baseBalance + lockedBonus;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-8 pb-16 px-4 md:px-8 max-w-4xl mx-auto w-full">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden mb-8">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Wallet className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <p className="text-white/70 text-sm font-medium mb-2 uppercase tracking-wider">Available Balance</p>
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight">৳{displayBalance.toFixed(2)}</h2>
              {isBonusLocked && (
                <div className="mt-3 flex items-center gap-2 text-amber-300 text-sm bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-500/20 w-fit">
                  <Lock className="w-4 h-4" />
                  <span>৳{lockedBonus} locked until 10 eligible sales ({eligibleSales}/10)</span>
                </div>
              )}
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={() => navigate('/withdraw')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition-colors shadow-sm"
              >
                <ArrowUpRight className="w-5 h-5" />
                Withdraw
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-main" />
            Transaction History & Withdrawals
          </h3>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <ArrowDownRight className="w-8 h-8" />
              </div>
              <p className="text-slate-500">No recent transactions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map(t => {
                const isCredit = t.type === 'credit' || t.category === 'refund';
                const dateVal = t.timestamp || t.createdAt;

                return (
                  <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-sky-100 hover:bg-sky-50/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'
                      }`}>
                        {isCredit ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 group-hover:text-primary-main transition-colors">
                          {isCredit 
                            ? (t.category === 'refund' ? 'অর্ডার বাতিল রিফান্ড (Order Refund)' : (t.description || 'Wallet Credit'))
                            : `Withdrawal - ${t.method || 'Bank / MFS'}`
                          }
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {dateVal ? new Date(dateVal).toLocaleDateString() : '-'} 
                          {t.mobileNumber ? ` • ${t.mobileNumber}` : ''}
                          {t.orderId ? ` • Order #${String(t.orderId).substring(0, 8)}` : ''}
                        </p>
                        {t.description && isCredit && (
                          <p className="text-[11px] text-slate-600 mt-0.5">{t.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold ${isCredit ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {isCredit ? `+৳${Number(t.amount || 0).toFixed(2)}` : `-৳${Number(t.amount || 0).toFixed(2)}`}
                      </p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${
                        t.status === 'Success' || t.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                        t.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {t.status || 'Success'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
