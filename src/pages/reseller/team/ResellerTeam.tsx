import React, { useState, useEffect } from 'react';
import Header from '../../../components/layout/Header';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getResellerReferralCode } from '../../../services/resellerReferralService';
import { Search, Activity, Award, Copy, ArrowUp, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface MLMMember {
  id: string;
  name: string;
  sponsorId: string;
  parentId: string;
  level: number;
  status: 'Active' | 'Inactive';
  joinDate: number;
  personalSales: number;
  teamSales: number;
  rank: string;
}

interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  totalTeamSales: number;
  personalSales: number;
  directSales: number;
  teamCommission: number;
}

interface CachedTeamState {
  userId: string;
  stats: TeamStats;
  referralCode: string;
  teamMembers: MLMMember[];
  sponsorNode: MLMMember | null;
  timestamp: number;
}

let cachedTeamData: CachedTeamState | null = null;

export default function ResellerTeam() {
  const { user } = useAuth();
  const [stats, setStats] = useState<TeamStats>(() => {
    if (cachedTeamData && cachedTeamData.userId === user?.uid) {
      return cachedTeamData.stats;
    }
    return {
      totalMembers: 0,
      activeMembers: 0,
      inactiveMembers: 0,
      totalTeamSales: 0,
      personalSales: 0,
      directSales: 0,
      teamCommission: 0
    };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    if (cachedTeamData && cachedTeamData.userId === user?.uid) {
      return cachedTeamData.referralCode;
    }
    return '';
  });
  
  const [teamMembers, setTeamMembers] = useState<MLMMember[]>(() => {
    if (cachedTeamData && cachedTeamData.userId === user?.uid) {
      return cachedTeamData.teamMembers;
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    if (cachedTeamData && cachedTeamData.userId === user?.uid) {
      return false;
    }
    return true;
  });

  const [sponsorNode, setSponsorNode] = useState<MLMMember | null>(() => {
    if (cachedTeamData && cachedTeamData.userId === user?.uid) {
      return cachedTeamData.sponsorNode;
    }
    return null;
  });

  useEffect(() => {
    if (user?.uid) {
      fetchInitialData();
    }
  }, [user?.uid]);

  const fetchInitialData = async () => {
    if (!user) return;
    if (!cachedTeamData || cachedTeamData.userId !== user.uid) {
      setLoading(true);
    }

    try {
      // 1. Fetch Referral Code from RTDB, Stats, and Member in Parallel with timeout guard
      const [directRefCode, [statsDoc, userDoc]] = await Promise.all([
        getResellerReferralCode(user.uid).catch(() => ''),
        Promise.race([
          Promise.all([
            getDoc(doc(db, 'mlm_team_statistics', user.uid)).catch(() => null),
            getDoc(doc(db, 'mlm_members', user.uid)).catch(() => null)
          ]),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([null, null]), 1800))
        ])
      ]);

      let refCode = directRefCode || referralCode || user.uid.substring(0, 8).toUpperCase();
      setReferralCode(refCode);

      let newStats = { ...stats };
      let newSponsor: MLMMember | null = sponsorNode;
      let allMembers: MLMMember[] = [...teamMembers];

      if (statsDoc && statsDoc.exists()) {
        newStats = statsDoc.data() as TeamStats;
        setStats(newStats);
      }

      if (userDoc && userDoc.exists()) {
        const currentUserData = { id: user.uid, ...userDoc.data() } as MLMMember;
        
        if (currentUserData.sponsorId) {
          try {
            const sponsorDoc = await getDoc(doc(db, 'mlm_members', currentUserData.sponsorId));
            if (sponsorDoc.exists()) {
              newSponsor = { id: sponsorDoc.id, ...sponsorDoc.data() } as MLMMember;
              setSponsorNode(newSponsor);
            }
          } catch (_) {}
        }

        // Fetch downlines with max limit
        allMembers = [];
        await fetchAllDownlines(user.uid, allMembers);
        setTeamMembers(allMembers);
      }

      cachedTeamData = {
        userId: user.uid,
        stats: newStats,
        referralCode: refCode,
        teamMembers: allMembers,
        sponsorNode: newSponsor,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error("Error fetching team data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDownlines = async (parentId: string, allMembers: MLMMember[], visited = new Set<string>()) => {
    if (visited.has(parentId)) return;
    visited.add(parentId);
    
    const q = query(collection(db, 'mlm_members'), where('sponsorId', '==', parentId));
    const snap = await getDocs(q);
    
    const children: MLMMember[] = [];
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() } as MLMMember;
      children.push(data);
      allMembers.push(data);
    });

    for (const child of children) {
      await fetchAllDownlines(child.id, allMembers, visited);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  const filteredMembers = teamMembers.filter(member => 
    member.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    member.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <Header />
      
      <main className="flex-grow pt-24 pb-32 px-4 max-w-4xl mx-auto w-full">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Leadership Network</h1>
          <p className="mt-1 text-sm text-gray-500">View your sponsor, downlines, and team statistics.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Team</span>
            <span className="text-2xl font-bold text-gray-900">{stats.totalMembers}</span>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Active</span>
            <span className="text-2xl font-bold text-green-600">{stats.activeMembers}</span>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Team Sales</span>
            <span className="text-2xl font-bold text-secondary-main">৳{stats.totalTeamSales.toLocaleString()}</span>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-center overflow-hidden">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Referral Code</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary-main truncate">{referralCode}</span>
              <button onClick={copyReferralLink} className="p-1.5 bg-gray-100 rounded-lg text-gray-600 hover:text-primary-main transition-colors shrink-0">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Upline Section */}
        {sponsorNode && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Your Sponsor (Upline)</h2>
            <div className="flex items-center p-4 bg-secondary-main/5 border border-secondary-main/20 rounded-2xl">
              <div className="w-12 h-12 bg-secondary-main text-white rounded-full flex items-center justify-center font-bold text-lg mr-4 shrink-0 overflow-hidden">
                {(sponsorNode.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-gray-900">{sponsorNode.name}</h4>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1 font-medium"><Award className="w-4 h-4 text-primary-main" /> {sponsorNode.rank || 'Member'}</span>
                </div>
              </div>
              <ArrowUp className="w-6 h-6 text-secondary-main/40" />
            </div>
          </div>
        )}

        {/* Downline List Section */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between mb-4 gap-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Your Downline Team</h2>
            <div className="relative max-w-sm w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search member name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 transition-shadow"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[400px] overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                <Activity className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Loading your network...</p>
              </div>
            ) : filteredMembers.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredMembers.map((member, index) => (
                  <div key={member.id} className="flex items-center p-4 hover:bg-gray-50 transition-colors">
                    {/* Serial Number */}
                    <div className="w-8 flex-shrink-0 text-gray-400 font-medium text-sm">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                    
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-main flex items-center justify-center font-bold mr-4 shrink-0">
                      {member.name ? member.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                    </div>
                    
                    {/* Member Info */}
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex-1 truncate">
                        <h4 className="text-sm font-bold text-gray-900 truncate">
                          {member.name || 'Unknown Member'}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 truncate">
                          <span className="flex items-center gap-1 font-medium text-secondary-main">
                            <Award className="w-3 h-3" /> {member.rank || 'Member'}
                          </span>
                          <span>Lvl {member.level}</span>
                          <span className="hidden sm:inline">ID: {member.id.substring(0, 8)}</span>
                        </div>
                      </div>
                      
                      {/* Status & Sales */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Sales</p>
                          <p className="text-sm font-bold text-gray-900">৳{member.personalSales?.toLocaleString() || 0}</p>
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                          member.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {member.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                <User className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm">No members found in your team.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
