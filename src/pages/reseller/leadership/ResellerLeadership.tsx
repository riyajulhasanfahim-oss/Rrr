import React, { useState, useEffect } from 'react';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, query, getDocs, where, setDoc } from 'firebase/firestore';
import { Award, Target, Shield, Crown, Users, DollarSign, Wallet, Activity, CheckCircle, TrendingUp, Infinity, Landmark, RefreshCw, Copy, Check, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { LinearProgress } from '@mui/material';
import toast from 'react-hot-toast';
import { getResellerWallet } from '../../../services/resellerWalletService';
import { getResellerReferralCode } from '../../../services/resellerReferralService';
import { rtdbGet } from '../../../lib/rtdb';

const DEFAULT_RANKS = [
  { id: 'rank_1', name: 'Member', level: 1, reqs: { personalSales: 0, teamSales: 0, activeDirects: 0, monthlySales: 0 }, bonus: 0 },
  { id: 'rank_2', name: 'Bronze', level: 2, reqs: { personalSales: 500, teamSales: 2000, activeDirects: 2, monthlySales: 500 }, bonus: 50 },
  { id: 'rank_3', name: 'Silver', level: 3, reqs: { personalSales: 1500, teamSales: 10000, activeDirects: 5, monthlySales: 2000 }, bonus: 200 },
  { id: 'rank_4', name: 'Gold', level: 4, reqs: { personalSales: 5000, teamSales: 50000, activeDirects: 10, monthlySales: 10000 }, bonus: 1000 },
];

interface CachedLeadershipState {
  userId: string;
  memberData: any;
  wallet: any;
  l1Members: any[];
  l2Members: any[];
  l3Members: any[];
  referralCode: string;
  timestamp: number;
}

let cachedLeadershipData: CachedLeadershipState | null = null;

export default function ResellerLeadership() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(() => {
    if (cachedLeadershipData && cachedLeadershipData.userId === user?.uid) {
      return false;
    }
    return true;
  });
  
  const [memberData, setMemberData] = useState<any>(() => {
    if (cachedLeadershipData && cachedLeadershipData.userId === user?.uid) {
      return cachedLeadershipData.memberData;
    }
    return null;
  });

  const [wallet, setWallet] = useState<any>(() => {
    if (cachedLeadershipData && cachedLeadershipData.userId === user?.uid) {
      return cachedLeadershipData.wallet;
    }
    return null;
  });

  const [l1Members, setL1Members] = useState<any[]>(() => {
    if (cachedLeadershipData && cachedLeadershipData.userId === user?.uid) {
      return cachedLeadershipData.l1Members;
    }
    return [];
  });

  const [l2Members, setL2Members] = useState<any[]>(() => {
    if (cachedLeadershipData && cachedLeadershipData.userId === user?.uid) {
      return cachedLeadershipData.l2Members;
    }
    return [];
  });

  const [l3Members, setL3Members] = useState<any[]>(() => {
    if (cachedLeadershipData && cachedLeadershipData.userId === user?.uid) {
      return cachedLeadershipData.l3Members;
    }
    return [];
  });

  const [referralCode, setReferralCode] = useState<string>(() => {
    if (cachedLeadershipData && cachedLeadershipData.userId === user?.uid) {
      return cachedLeadershipData.referralCode;
    }
    return '';
  });

  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    if (user?.uid) {
      loadData();
    }
  }, [user?.uid]);

  const loadData = async () => {
    if (!user) return;
    if (!cachedLeadershipData || cachedLeadershipData.userId !== user.uid) {
      setLoading(true);
    }

    try {
      // 1. Fetch Member, Wallet from RTDB, Referral Code in parallel
      const [rtdbWallet, directCode, mDoc] = await Promise.all([
        getResellerWallet(user.uid).catch(() => null),
        getResellerReferralCode(user.uid).catch(() => ''),
        Promise.race([
          getDoc(doc(db, 'mlm_members', user.uid)).catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ])
      ]);

      let mData = { rankName: 'Member', rankLevel: 1, personalSales: 0, teamSales: 0, monthlySales: 0, activeDirects: 0 };
      if (mDoc && mDoc.exists()) {
        mData = { id: mDoc.id, ...mDoc.data() };
      }
      setMemberData(mData);

      let wData = { 
        walletBalance: rtdbWallet?.availableBalance ?? rtdbWallet?.walletBalance ?? 0, 
        approvedCommission: rtdbWallet?.releasedProfit ?? rtdbWallet?.approvedCommission ?? 0, 
        pendingCommission: rtdbWallet?.pendingProfit ?? rtdbWallet?.pendingCommission ?? 0, 
        lifetimeCommission: rtdbWallet?.releasedProfit ?? rtdbWallet?.lifetimeCommission ?? 0 
      };
      setWallet(wData);

      let refCode = directCode || referralCode || user.uid.substring(0, 8).toUpperCase();
      setReferralCode(refCode);

      // 2. Fetch L1 Members
      let level1: any[] = [];
      let level2: any[] = [];
      let level3: any[] = [];

      try {
        const l1Query = query(collection(db, 'mlm_members'), where('sponsorId', '==', user.uid));
        const l1Snap = await getDocs(l1Query);
        level1 = l1Snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setL1Members(level1);
        
        if (level1.length > 0) {
          const l1Ids = level1.map(m => m.id).slice(0, 10);
          if (l1Ids.length > 0) {
            const l2Query = query(collection(db, 'mlm_members'), where('sponsorId', 'in', l1Ids));
            const l2Snap = await getDocs(l2Query);
            level2 = l2Snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setL2Members(level2);
            
            if (level2.length > 0) {
              const l2Ids = level2.map(m => m.id).slice(0, 10);
              if (l2Ids.length > 0) {
                const l3Query = query(collection(db, 'mlm_members'), where('sponsorId', 'in', l2Ids));
                const l3Snap = await getDocs(l3Query);
                level3 = l3Snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setL3Members(level3);
              }
            }
          }
        }
      } catch (_) {}

      cachedLeadershipData = {
        userId: user.uid,
        memberData: mData,
        wallet: wData,
        l1Members: level1,
        l2Members: level2,
        l3Members: level3,
        referralCode: refCode,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error("Error loading leadership data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !memberData) {
     return (
       <div className="min-h-screen bg-slate-50 flex flex-col">
         <Header />
         <div className="flex-grow flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-main"></div>
         </div>
         <Footer />
       </div>
     );
  }

  const level1Count = l1Members.length;
  const level2Count = l2Members.length;
  const level3Count = l3Members.length;
  
  const totalTeam = level1Count + level2Count + level3Count;
  const activeMembers = [...l1Members, ...l2Members, ...l3Members].filter(m => m.status === 'Active').length;

  const currentRankInfo = DEFAULT_RANKS.find(r => r.name === memberData?.rankName) || DEFAULT_RANKS[0];
  const nextRankInfo = DEFAULT_RANKS.find(r => r.level > currentRankInfo.level) || null;

  let progressPercentage = 100;
  if (nextRankInfo) {
    const reqs = nextRankInfo.reqs;
    const psProg = reqs.personalSales > 0 ? Math.min(100, ((memberData?.personalSales || 0) / reqs.personalSales) * 100) : 100;
    const tsProg = reqs.teamSales > 0 ? Math.min(100, ((memberData?.teamSales || 0) / reqs.teamSales) * 100) : 100;
    const msProg = reqs.monthlySales > 0 ? Math.min(100, ((memberData?.monthlySales || 0) / reqs.monthlySales) * 100) : 100;
    
    // active direct is based on l1 active members
    const activeL1 = l1Members.filter(m => m.status === 'Active').length;
    const adProg = reqs.activeDirects > 0 ? Math.min(100, (activeL1 / reqs.activeDirects) * 100) : 100;
    
    progressPercentage = Math.round((psProg + tsProg + msProg + adProg) / 4);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      
      <main className="flex-grow py-8 px-4 sm:px-6 max-w-7xl mx-auto w-full pb-32 space-y-6">
        
        {/* Page Title */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Crown className="w-8 h-8 text-primary-main" />
              Premium Rank Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">Monitor your Leadership progression, commissions, and team network structure below.</p>
          </div>
        </div>

        {/* Top Dashboard Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <DashboardCard icon={<Award className="text-white w-6 h-6" />} title="Current Rank" value={memberData?.rankName || 'Member'} bg="bg-gradient-to-br from-blue-600 to-blue-800" textClass="text-white" />
          <DashboardCard icon={<Wallet className="text-blue-600 w-6 h-6" />} title="Wallet Balance" value={`৳${(wallet?.walletBalance || 0).toLocaleString()}`} />
          <DashboardCard icon={<DollarSign className="text-green-600 w-6 h-6" />} title="Leadership Commission" value={`৳${(wallet?.approvedCommission || 0).toLocaleString()}`} />
          <DashboardCard icon={<Users className="text-purple-600 w-6 h-6" />} title="Total Team" value={totalTeam.toString()} />
          <DashboardCard icon={<CheckCircle className="text-teal-600 w-6 h-6" />} title="Active Members" value={activeMembers.toString()} />
          <DashboardCard icon={<TrendingUp className="text-orange-600 w-6 h-6" />} title="Rank Progress" value={`${progressPercentage}%`} />
        </div>

        {/* Rank Progression Section */}
        {nextRankInfo && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 mt-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 relative z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-6 h-6 text-primary-main" />
                  Next Rank: {nextRankInfo.name}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Complete the requirements below to be automatically promoted.</p>
              </div>
              <div className="mt-4 sm:mt-0 text-right">
                <h3 className="text-3xl font-black text-primary-main">{progressPercentage}%</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Progress</p>
              </div>
            </div>
            
            <div className="mb-8 relative z-10">
              <LinearProgress 
                variant="determinate" 
                value={progressPercentage} 
                sx={{ 
                  height: 12, 
                  borderRadius: 6,
                  backgroundColor: '#f1f5f9',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 6,
                    backgroundColor: progressPercentage === 100 ? '#10b981' : '#0ea5e9'
                  }
                }} 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              <RequirementCard 
                title="Personal Sales" 
                current={memberData?.personalSales || 0} 
                required={nextRankInfo.reqs.personalSales} 
                prefix="৳"
              />
              <RequirementCard 
                title="Team Sales" 
                current={memberData?.teamSales || 0} 
                required={nextRankInfo.reqs.teamSales} 
                prefix="৳"
              />
              <RequirementCard 
                title="Monthly Sales" 
                current={memberData?.monthlySales || 0} 
                required={nextRankInfo.reqs.monthlySales} 
                prefix="৳"
              />
              <RequirementCard 
                title="Active Directs" 
                current={l1Members.filter(m => m.status === 'Active').length} 
                required={nextRankInfo.reqs.activeDirects} 
                prefix=""
              />
            </div>
          </div>
        )}

        {/* Commissions Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <CommissionCard 
            title="Approved Commission" 
            amount={wallet?.approvedCommission || 0} 
            icon={<CheckCircle className="w-8 h-8 text-green-500" />} 
            subtitle="Ready to withdraw"
            delay={0.1}
          />
          <CommissionCard 
            title="Pending Commission" 
            amount={wallet?.pendingCommission || 0} 
            icon={<RefreshCw className="w-8 h-8 text-amber-500" />} 
            subtitle="Awaiting clearance"
            delay={0.2}
          />
          <CommissionCard 
            title="Lifetime Earnings" 
            amount={wallet?.lifetimeCommission || 0} 
            icon={<Landmark className="w-8 h-8 text-blue-500" />} 
            subtitle="Total Leadership earnings"
            delay={0.3}
          />
        </div>

        {/* MLM Tree Section */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mt-8 overflow-hidden">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-primary-main" />
              Leadership Network Tree
            </h2>
          </div>
          
          <div className="space-y-12 overflow-x-auto pb-8 relative z-10 custom-scrollbar">
            <TreeLevel level={1} current={level1Count} members={l1Members} />
            <TreeLevel level={2} current={level2Count} members={l2Members} />
            <TreeLevel level={3} current={level3Count} members={l3Members} isLast={true} />
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 flex flex-col items-center justify-center p-10 bg-blue-50/50 rounded-3xl border border-blue-100/50 relative overflow-hidden"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/40 blur-3xl rounded-full z-0"></div>
              <Infinity className="w-12 h-12 text-blue-400 mb-4 z-10" />
              <h3 className="text-2xl font-black text-slate-900 z-10">Unlimited Members</h3>
              <p className="text-base text-slate-600 font-medium z-10 mt-1">Total Team Size: <span className="text-primary-main font-bold text-lg ml-1">{totalTeam}</span></p>
              <p className="text-sm text-slate-500 mt-3 text-center max-w-sm z-10 bg-white/60 px-4 py-2 rounded-xl backdrop-blur-sm border border-white mb-8">The network is unlimited, but commissions are calculated only for Levels 1–3.</p>
              
              {/* Referral Link Box */}
              <div className="z-10 w-full max-w-lg bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
                <h4 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2 mb-2">
                  <Share2 className="w-5 h-5 text-green-600" /> Share Referral Link
                </h4>
                <p className="text-sm font-bold text-green-700 bg-green-50 inline-block px-4 py-1.5 rounded-full border border-green-100 mb-6 shadow-sm">
                  Invite your friend and earning 150 Tk
                </p>
                
                <div className="mb-4 text-left bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Your Referral Code</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-slate-900">{referralCode}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(referralCode);
                        toast.success('Code copied!');
                      }}
                      className="text-primary-main hover:text-primary-dark font-bold text-sm flex items-center gap-1"
                    >
                      <Copy className="w-4 h-4" /> Copy Code
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-grow text-left w-full truncate flex items-center justify-between">
                     <span className="text-sm font-medium text-slate-600 truncate mr-2">
                       {window.location.origin}/register?ref={referralCode}
                     </span>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/register?ref=${referralCode}`);
                      setCopied(true);
                      toast.success('Referral link copied!');
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="bg-primary-main hover:bg-primary-dark text-white rounded-xl px-6 py-3 font-bold shadow-sm transition-all flex items-center gap-2 whitespace-nowrap w-full sm:w-auto justify-center"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

      </main>
      
      <Footer />
    </div>
  );
}

function RequirementCard({ title, current, required, prefix }: any) {
  const p = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100;
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p === 100 ? 'bg-green-100 text-green-700' : 'bg-white text-slate-700 shadow-sm'}`}>
          {p}%
        </span>
      </div>
      <LinearProgress 
        variant="determinate" 
        value={p} 
        sx={{ 
          height: 6, 
          borderRadius: 3, 
          mb: 2,
          backgroundColor: '#e2e8f0',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            backgroundColor: p === 100 ? '#10b981' : '#0ea5e9'
          }
        }} 
      />
      <div className="text-xs font-bold text-slate-900 text-right">
        {prefix}{current.toLocaleString()} <span className="text-slate-400 font-medium">/ {prefix}{required.toLocaleString()}</span>
      </div>
    </div>
  );
}

function DashboardCard({ icon, title, value, bg = "bg-white", textClass = "text-slate-900" }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${bg} rounded-2xl p-5 shadow-sm border ${bg === 'bg-white' ? 'border-slate-100' : 'border-transparent'} flex flex-col justify-between h-full hover:shadow-md transition-shadow`}
    >
      <div className={`p-2.5 rounded-xl w-fit ${bg === 'bg-white' ? 'bg-blue-50' : 'bg-white/20'}`}>
        {icon}
      </div>
      <div className="mt-5">
        <p className={`text-[11px] uppercase tracking-wider font-bold mb-1 ${bg === 'bg-white' ? 'text-slate-400' : 'text-white/70'}`}>{title}</p>
        <h3 className={`text-xl font-extrabold ${textClass} truncate`}>{value}</h3>
      </div>
    </motion.div>
  );
}

function CommissionCard({ title, amount, icon, subtitle, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow"
    >
      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 mb-1">৳{amount.toLocaleString()}</h3>
        <p className="text-xs font-medium text-slate-500">{subtitle}</p>
      </div>
    </motion.div>
  );
}

function TreeLevel({ level, current, members, isLast }: any) {
  let earningText = '';
  if (level === 1) earningText = 'Invite your friend, earning 150 Tk';
  else if (level === 2) earningText = 'Invite your friend, earning 100 Tk';
  else if (level === 3) earningText = 'Invite your friend, earning 50 Tk';

  return (
    <div className="relative pl-6 lg:pl-12 mt-6">
      <div className="absolute left-10 lg:left-16 -top-12 w-0.5 h-12 bg-blue-100"></div>
      
      {earningText && (
        <div className="mb-3 pl-2 relative z-10">
          <span className="inline-block bg-green-50 text-green-700 text-[11px] font-black px-3 py-1.5 rounded-full border border-green-200 shadow-sm tracking-wide">
            {earningText}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6">
        <div className="flex items-center gap-4 z-10 relative bg-white px-2 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 font-black text-lg flex items-center justify-center border-2 border-blue-100 shadow-sm shrink-0">
            L{level}
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-lg">Level {level}</h4>
            <p className="text-xs text-slate-500 font-semibold">{current} Members</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 pb-4 pl-4 lg:pl-10">
        {members.map((m: any, i: number) => (
          <MemberCard key={i} member={m} index={i + 1} level={level} delay={i * 0.1} />
        ))}
        {members.length === 0 && (
          <div className="flex items-center justify-center h-20 w-full max-w-2xl rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
             <span className="text-sm font-bold text-slate-400">No Members</span>
          </div>
        )}
      </div>
      {!isLast && (
        <div className="absolute left-10 lg:left-16 bottom-0 w-0.5 h-12 bg-blue-100 translate-y-full"></div>
      )}
    </div>
  );
}

function MemberCard({ member, index, level, delay }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-between group hover:border-primary-main hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
          {index}
        </div>
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-slate-50 border-2 border-slate-100 group-hover:border-blue-100 flex items-center justify-center overflow-hidden transition-colors shadow-inner shrink-0">
            {member.photo ? (
              <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-6 h-6 text-slate-300 group-hover:text-blue-400 transition-colors" />
            )}
          </div>
          {member.status === 'Active' && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <div>
          <h5 className="text-sm font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">{member.name || 'Team Member'}</h5>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Level {level}</span>
            <span className="text-[10px] font-medium text-slate-400 hidden sm:inline-block">ID: {member.id.substring(0, 8)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border shadow-sm ${member.status === 'Active' ? 'text-green-700 bg-green-50 border-green-100' : 'text-slate-500 bg-slate-50 border-slate-200'}`}>
          {member.status || 'Pending'}
        </span>
      </div>
    </motion.div>
  );
}

function EmptyMemberCard() {
  return (
    <div className="w-44 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 p-5 flex flex-col items-center justify-center text-center opacity-70 shrink-0">
      <div className="w-16 h-16 rounded-full bg-white mb-4 flex items-center justify-center border-2 border-slate-100 border-dashed shadow-sm">
        <UserIcon className="w-6 h-6 text-slate-300" />
      </div>
      <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Empty Slot</h5>
    </div>
  );
}

function UserIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
