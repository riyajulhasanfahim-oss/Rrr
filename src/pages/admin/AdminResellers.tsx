import React, { useEffect, useState, useMemo } from 'react';
import { rtdbGet, rtdbList, rtdbUpdate } from '../../lib/rtdb';
import { Search, Filter, Eye, CheckCircle, XCircle, Users, Activity, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import VerifiedBadge from '../../components/ui/VerifiedBadge';

const formatResellerDate = (val: any) => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'PPP');
  } catch {
    return 'N/A';
  }
};

export default function AdminResellers() {
  const [resellers, setResellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedReseller, setSelectedReseller] = useState<any | null>(null);
  const [togglingBadge, setTogglingBadge] = useState<string | null>(null);

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    try {
      setLoading(true);
      
      const resellerMap = new Map<string, any>();

      // 1. Fetch all items from RTDB 'resellers'
      const rtdbResellers = await rtdbList<any>('resellers');
      rtdbResellers.forEach(({ id, data }) => {
        if (!id || !data) return;
        resellerMap.set(id, {
          id,
          ...data,
          name: data.fullName || data.name || 'Unknown Reseller',
          email: data.email || '',
          phone: data.mobileNumber || data.phone || '',
          paymentMethod: data.paymentMethod || 'N/A',
          transactionId: data.transactionId || 'N/A',
          address: data.address || 'N/A',
          facebookProfile: data.facebookProfile || 'N/A',
          status: data.status || 'pending',
          totalSales: Number(data.totalSales) || 0,
          totalOrders: Number(data.totalOrders) || 0,
          totalCommission: Number(data.totalCommission) || 0,
          currentBalance: Number(data.wallet || data.balance || data.resellerBalance || 0),
          resellerData: data
        });
      });

      // 2. Also check RTDB 'users' for any user with reseller role not already in map
      try {
        const rtdbUsers = await rtdbList<any>('users');
        rtdbUsers.forEach(({ id, data }) => {
          if (!id || !data) return;
          const role = (data.role || '').toLowerCase();
          const isResellerUser = role === 'reseller' || data.isReseller === true;
          if (isResellerUser) {
            const existing = resellerMap.get(id);
            if (!existing) {
              resellerMap.set(id, {
                id,
                ...data,
                name: data.fullName || data.name || data.displayName || 'Unknown Reseller',
                email: data.email || '',
                phone: data.phone || data.mobileNumber || '',
                paymentMethod: data.paymentMethod || 'N/A',
                transactionId: data.transactionId || 'N/A',
                address: data.address || 'N/A',
                facebookProfile: data.facebookProfile || 'N/A',
                status: data.status || 'active',
                totalSales: Number(data.totalSales) || 0,
                totalOrders: Number(data.totalOrders) || 0,
                totalCommission: Number(data.totalCommission) || 0,
                currentBalance: Number(data.wallet || data.balance || data.resellerBalance || 0),
                resellerData: data
              });
            } else {
              // merge additional fields from users if missing
              if (!existing.phone && data.phone) existing.phone = data.phone;
              if (!existing.email && data.email) existing.email = data.email;
            }
          }
        });
      } catch (err) {
        console.warn('Error reading users for resellers:', err);
      }

      setResellers(Array.from(resellerMap.values()));
    } catch (error) {
      console.error('Error fetching resellers from RTDB:', error);
      toast.error('Failed to load resellers');
    } finally {
      setLoading(false);
    }
  };

  const approveReseller = async (resellerId: string) => {
    try {
      await Promise.allSettled([
        rtdbUpdate(`users/${resellerId}`, { role: 'Reseller', status: 'active', updatedAt: Date.now() }),
        rtdbUpdate(`resellers/${resellerId}`, { status: 'active', updatedAt: Date.now() })
      ]);
      toast.success('Reseller approved successfully');
      fetchResellers();
      setSelectedReseller(null);
    } catch (error) {
      console.error('Error approving reseller:', error);
      toast.error('Failed to approve reseller');
    }
  };

  const toggleStatus = async (resellerId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await Promise.allSettled([
        rtdbUpdate(`users/${resellerId}`, { status: newStatus, updatedAt: Date.now() }),
        rtdbUpdate(`resellers/${resellerId}`, { status: newStatus, updatedAt: Date.now() })
      ]);
      toast.success(`Reseller ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
      fetchResellers();
      setSelectedReseller(null);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const isResellerVerified = (r: any) => {
    return Boolean(
      r?.isVerified ||
      r?.verified ||
      r?.verificationBadge ||
      r?.blueBadge ||
      r?.isBlueBadge ||
      r?.verificationStatus === 'verified' ||
      r?.isVerifiedSeller ||
      r?.resellerData?.isVerified ||
      r?.resellerData?.blueBadge
    );
  };

  const toggleVerifiedBadge = async (reseller: any) => {
    try {
      setTogglingBadge(reseller.id);
      const currentVerified = isResellerVerified(reseller);
      const newStatus = !currentVerified;

      const payload = {
        isVerified: newStatus,
        verified: newStatus,
        blueBadge: newStatus,
        verificationBadge: newStatus,
        isVerifiedSeller: newStatus,
        verificationStatus: newStatus ? 'verified' : 'unverified',
        verifiedAt: newStatus ? Date.now() : null,
        updatedAt: Date.now()
      };

      await Promise.allSettled([
        rtdbUpdate(`users/${reseller.id}`, payload),
        rtdbUpdate(`resellers/${reseller.id}`, payload)
      ]);

      setResellers(prev => prev.map(r => r.id === reseller.id ? { ...r, ...payload } : r));
      if (selectedReseller && selectedReseller.id === reseller.id) {
        setSelectedReseller({ ...selectedReseller, ...payload });
      }
      toast.success(newStatus ? 'Reseller verified badge granted (RTDB)!' : 'Reseller verified badge revoked (RTDB)!');
    } catch (error) {
      console.error('Error toggling reseller verified badge:', error);
      toast.error('Failed to update verified badge');
    } finally {
      setTogglingBadge(null);
    }
  };

  const filtered = useMemo(() => {
    return resellers
      .filter(r => {
        const searchMatch = 
          r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.id?.toLowerCase().includes(searchTerm.toLowerCase());

        const verified = isResellerVerified(r);
        const filterMatch = 
          statusFilter === 'All' ? true :
          statusFilter === 'Verified' ? verified :
          statusFilter === 'Active' ? r.status === 'active' :
          statusFilter === 'Pending' ? r.status === 'pending' :
          statusFilter === 'Suspended' ? r.status === 'suspended' || r.status === 'inactive' :
          true;

        return searchMatch && filterMatch;
      })
      .sort((a, b) => {
        const aVer = isResellerVerified(a);
        const bVer = isResellerVerified(b);
        if (aVer && !bVer) return -1;
        if (!aVer && bVer) return 1;
        return 0;
      });
  }, [resellers, searchTerm, statusFilter]);

  const verifiedResellersCount = useMemo(() => {
    return resellers.filter(r => isResellerVerified(r)).length;
  }, [resellers]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resellers Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage resellers, their sales, and performance (100% RTDB Realtime Database).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Resellers</p>
          <p className="text-xl font-bold text-slate-900">{resellers.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center bg-blue-50/20">
          <p className="text-xs text-blue-600 font-medium mb-1 flex items-center justify-center gap-1">
            <BadgeCheck className="w-3.5 h-3.5 text-blue-600" /> Verified Badges
          </p>
          <p className="text-xl font-bold text-blue-700">{verifiedResellersCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Active Resellers</p>
          <p className="text-xl font-bold text-emerald-600">
            {resellers.filter(r => r.status === 'active').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Pending Approval</p>
          <p className="text-xl font-bold text-amber-600">
            {resellers.filter(r => r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Suspended</p>
          <p className="text-xl font-bold text-rose-600">
            {resellers.filter(r => r.status === 'suspended' || r.status === 'inactive').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search resellers by name, email, phone, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 w-full sm:w-auto overflow-x-auto">
              {['All', 'Verified', 'Active', 'Pending', 'Suspended'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    statusFilter === tab 
                      ? tab === 'Verified' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'Verified' && <BadgeCheck className="w-3.5 h-3.5 text-blue-300" />}
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold">Reseller Name</th>
                <th className="px-6 py-4 font-semibold">Contact Info</th>
                <th className="px-6 py-4 font-semibold text-center">Sales/Orders</th>
                <th className="px-6 py-4 font-semibold text-center">Wallet</th>
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
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No resellers found.</td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const verified = isResellerVerified(r);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors bg-white">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900">{r.name}</p>
                              {verified && (
                                <VerifiedBadge size="xs" title="Verified Reseller (RTDB)" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500">ID: {r.id.substring(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-900 font-medium">{r.email}</p>
                        <p className="text-xs text-slate-500">{r.phone || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-sm">
                            ৳{r.totalSales?.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500">{r.totalOrders} Orders</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-900">৳{r.currentBalance?.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : r.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> : r.status === 'pending' ? <Activity className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {r.status === 'active' ? 'Active' : r.status === 'pending' ? 'Pending' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Verified Badge Button */}
                          <button 
                            onClick={() => toggleVerifiedBadge(r)}
                            disabled={togglingBadge === r.id}
                            className={`p-2 rounded-lg transition-colors border ${
                              verified 
                                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' 
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-300'
                            }`}
                            title={verified ? "Remove Verified Badge (RTDB)" : "Grant Verified Badge (RTDB)"}
                          >
                            <BadgeCheck className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => setSelectedReseller(r)}
                            className="p-2 rounded-lg text-slate-400 hover:text-primary-main hover:bg-sky-50 transition-colors border border-transparent hover:border-slate-200"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (r.status === 'pending') {
                                approveReseller(r.id);
                              } else {
                                toggleStatus(r.id, r.status);
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${r.status === 'active' ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                            title={r.status === 'pending' ? "Approve Reseller" : r.status === 'active' ? "Suspend Reseller" : "Activate Reseller"}
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-main" /> Reseller Details
              </h2>
              <button onClick={() => setSelectedReseller(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-2xl">
                  {selectedReseller.name?.charAt(0) || 'R'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedReseller.name}</h3>
                  <p className="text-sm text-slate-500">Reseller ID: {selectedReseller.id.substring(0, 8)}</p>
                </div>
                <div className="ml-auto">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${selectedReseller.status === 'active' ? 'bg-emerald-100 text-emerald-700' : selectedReseller.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {selectedReseller.status === 'active' ? 'Active Account' : selectedReseller.status === 'pending' ? 'Pending Approval' : 'Suspended Account'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium mb-1">Total Sales</p>
                  <p className="text-lg font-bold text-emerald-600">৳{selectedReseller.totalSales?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium mb-1">Total Orders</p>
                  <p className="text-lg font-bold text-sky-600">{selectedReseller.totalOrders}</p>
                </div>
                <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium mb-1">Total Commission</p>
                  <p className="text-lg font-bold text-purple-600">৳{selectedReseller.totalCommission?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium mb-1">Current Balance</p>
                  <p className="text-lg font-bold text-slate-900">৳{selectedReseller.currentBalance?.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Contact Information</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Email Address</span>
                      <span className="font-medium text-slate-900">{selectedReseller.email}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Phone Number</span>
                      <span className="font-medium text-slate-900">{selectedReseller.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Facebook Profile</span>
                      <span className="font-medium text-slate-900 truncate max-w-[150px]" title={selectedReseller.facebookProfile}>{selectedReseller.facebookProfile !== 'N/A' ? <a href={selectedReseller.facebookProfile} target="_blank" rel="noreferrer" className="text-primary-main hover:underline">Link</a> : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Joined Date</span>
                      <span className="font-medium text-slate-900">
                        {formatResellerDate(selectedReseller.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-col py-2 border-b border-slate-50 gap-1">
                      <span className="text-slate-500">Full Address</span>
                      <span className="font-medium text-slate-900 text-right">{selectedReseller.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Payment Details</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Payment Method</span>
                      <span className="font-bold text-slate-900 uppercase">{selectedReseller.paymentMethod || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Transaction ID</span>
                      <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded">{selectedReseller.transactionId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Registration Fee</span>
                      <span className="font-bold text-emerald-600">৳{selectedReseller.registrationFee || 150}</span>
                    </div>
                    {selectedReseller.appliedPromoCode && (
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-slate-500">Invite Code Used</span>
                        <span className="font-bold text-purple-600 font-mono">{selectedReseller.appliedPromoCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex flex-wrap justify-between items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {selectedReseller.status === 'pending' && (
                  <button 
                    onClick={() => approveReseller(selectedReseller.id)} 
                    className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve Reseller
                  </button>
                )}
                <button 
                  onClick={() => toggleVerifiedBadge(selectedReseller)}
                  disabled={togglingBadge === selectedReseller.id}
                  className={`px-5 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 border ${
                    isResellerVerified(selectedReseller)
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:text-blue-600 hover:border-blue-200'
                  }`}
                >
                  <BadgeCheck className="w-4 h-4 text-blue-600" />
                  {isResellerVerified(selectedReseller) ? 'Revoke Badge (RTDB)' : 'Grant Badge (RTDB)'}
                </button>
                {selectedReseller.status === 'active' && (
                  <button 
                    onClick={() => toggleStatus(selectedReseller.id, selectedReseller.status)} 
                    className="px-6 py-2 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 transition-colors flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Suspend Reseller
                  </button>
                )}
                {selectedReseller.status === 'suspended' && (
                  <button 
                    onClick={() => toggleStatus(selectedReseller.id, selectedReseller.status)} 
                    className="px-6 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold hover:bg-emerald-200 transition-colors flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Reactivate Reseller
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedReseller(null)} className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
