import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { rtdbGet, rtdbUpdate, rtdbList } from '../../lib/rtdb';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Shield, CreditCard, Activity, Briefcase, Network, ShoppingBag, CheckCircle, XCircle, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import VerifiedBadge from '../../components/ui/VerifiedBadge';
import { saveStoreToCache } from '../../services/storeCache';

const safeFormatDate = (val: any, pattern: string) => {
  if (!val) return 'Unknown';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'Unknown' : format(d, pattern);
  } catch {
    return 'Unknown';
  }
};

export default function AdminUserDetails() {
  const { id } = useParams();
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchUserDetails();
    }
  }, [id]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      let foundUser: any = null;

      // 1. Fetch from RTDB users
      try {
        const rtdbUser = await rtdbGet<any>(`users/${id}`);
        if (rtdbUser) {
          foundUser = { id, ...rtdbUser };
        }
      } catch (e) {
        console.warn('RTDB user fetch notice:', e);
      }

      // 2. If not found, check resellers or vendors in RTDB
      if (!foundUser) {
        try {
          const rReseller = await rtdbGet<any>(`resellers/${id}`);
          if (rReseller) {
            foundUser = {
              id,
              ...rReseller,
              name: rReseller.fullName || rReseller.name,
              phone: rReseller.mobileNumber || rReseller.phone,
              role: 'reseller'
            };
          }
        } catch {}
      }

      if (!foundUser) {
        try {
          const rVendor = await rtdbGet<any>(`vendors/${id}`);
          if (rVendor) {
            foundUser = {
              id,
              ...rVendor,
              name: rVendor.ownerName || rVendor.name,
              phone: rVendor.mobileNumber || rVendor.phone,
              role: 'vendor'
            };
          }
        } catch {}
      }

      if (foundUser) {
        setUser(foundUser);
      }

      // Fetch transactions involving this user from RTDB
      try {
        const [rTxList, refTxList] = await Promise.all([
          rtdbList<any>('reseller_transactions', (t) => t.resellerId === id || t.userId === id).catch(() => []),
          rtdbList<any>('user_referral_transactions', (t) => t.referrerId === id || t.userId === id).catch(() => [])
        ]);

        const rTx = rTxList.map(item => ({ id: item.id, type: 'Reseller Commission', ...item.data }));
        const refTx = refTxList.map(item => ({ id: item.id, type: 'Referral Commission', ...item.data }));

        const allTx = [...rTx, ...refTx].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        setTransactions(allTx);
      } catch {
        setTransactions([]);
      }

    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const isUserVerified = () => {
    if (!user) return false;
    return Boolean(
      user.isVerified ||
      user.verified ||
      user.verificationBadge ||
      user.blueBadge ||
      user.isBlueBadge ||
      user.verificationStatus === 'verified' ||
      user.isVerifiedSeller
    );
  };

  const toggleVerifiedBadge = async () => {
    if (!user) return;
    try {
      setUpdating(true);
      const currentVerified = isUserVerified();
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
        rtdbUpdate(`users/${user.id}`, payload),
        rtdbUpdate(`resellers/${user.id}`, payload),
        rtdbUpdate(`vendors/${user.id}`, payload),
        rtdbUpdate(`vendor_profiles/${user.id}`, payload),
        rtdbUpdate(`stores/${user.id}`, payload)
      ]);

      saveStoreToCache(user.id, { id: user.id, vendorId: user.id, ...payload });

      setUser({ ...user, ...payload });
      toast.success(newStatus ? 'Verified badge granted!' : 'Verified badge removed!');
    } catch (error) {
      console.error('Error toggling verified badge in RTDB:', error);
      toast.error('Failed to update verified badge');
    } finally {
      setUpdating(false);
    }
  };

  const toggleStatus = async () => {
    if (!user) return;
    try {
      setUpdating(true);
      const newStatus = user.status === 'inactive' ? 'active' : 'inactive';
      const payload = { status: newStatus, updatedAt: Date.now() };

      await Promise.allSettled([
        rtdbUpdate(`users/${user.id}`, payload),
        rtdbUpdate(`resellers/${user.id}`, payload),
        rtdbUpdate(`vendors/${user.id}`, payload)
      ]);
      setUser({ ...user, status: newStatus });
      toast.success(`User account marked as ${newStatus}`);
    } catch (error) {
      console.error('Error updating status in RTDB:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const changeUserRole = async (newRole: string) => {
    if (!user) return;
    try {
      setUpdating(true);
      const payload = { role: newRole, updatedAt: Date.now() };

      await Promise.allSettled([
        rtdbUpdate(`users/${user.id}`, payload),
        rtdbUpdate(`resellers/${user.id}`, payload),
        rtdbUpdate(`vendors/${user.id}`, payload)
      ]);
      setUser({ ...user, role: newRole });
      toast.success(`Role changed to ${newRole}`);
    } catch (error) {
      console.error('Error updating user role in RTDB:', error);
      toast.error('Failed to update user role');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">User not found.</p>
        <Link to="/admin/users" className="text-primary-main hover:underline mt-2 inline-block">Back to Users</Link>
      </div>
    );
  }

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
      <div className="flex items-center gap-4">
        <Link to="/admin/users" className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Details</h1>
          <p className="text-sm text-slate-500">View and manage detailed information for this user.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} className="w-24 h-24 rounded-full object-cover border-4 border-slate-50" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-4 border-slate-50">
                  <span className="text-3xl font-bold text-slate-300">{(user.name || 'U').charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <h2 className="text-xl font-bold text-slate-900">{user.name || 'Unnamed User'}</h2>
                {isUserVerified() && <VerifiedBadge size="sm" title="ভেরিফাইড ব্যাচ ইউজার" />}
              </div>
              <p className="text-sm text-slate-500 font-mono mt-1">ID: {user.id}</p>
              
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                  user.role === 'vendor' ? 'bg-purple-100 text-purple-700' :
                  user.role === 'reseller' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {(user.role || 'customer').toUpperCase()}
                </span>
                {isUserVerified() && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700 flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" /> VERIFIED
                  </span>
                )}
                {user.isMLMMember && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700">
                    MLM
                  </span>
                )}
                {user.status === 'inactive' ? (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> INACTIVE
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> ACTIVE
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 w-full space-y-2">
                <button 
                  onClick={toggleVerifiedBadge}
                  disabled={updating}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 border ${
                    isUserVerified()
                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-200'
                  }`}
                >
                  <BadgeCheck className="w-4 h-4 text-blue-600" />
                  {isUserVerified() ? 'Revoke Verified Badge (RTDB)' : 'Grant Verified Badge (RTDB)'}
                </button>

                <button 
                  onClick={toggleStatus}
                  disabled={updating}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors ${
                    user.status === 'inactive' 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                    : 'bg-red-50 hover:bg-red-100 text-red-600'
                  }`}
                >
                  {user.status === 'inactive' ? 'Activate Account' : 'Deactivate Account'}
                </button>

                {/* Role Switcher */}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-1.5 text-left font-medium">Change Role (RTDB):</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['customer', 'reseller', 'vendor'].map(r => (
                      <button
                        key={r}
                        onClick={() => changeUserRole(r)}
                        disabled={updating || (user.role || 'customer') === r}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold uppercase transition-all ${
                          (user.role || 'customer') === r
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3 text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-sm">{user.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-sm">{user.phone || 'No phone provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-sm">{user.address || 'No address provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-sm">Joined {safeFormatDate(user.createdAt, 'MMMM d, yyyy')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" /> Referral Info
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">My Referral Code</p>
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm font-mono text-slate-900 break-all">
                  {user.referralId || 'None'}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Referred By (Sponsor)</p>
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm font-mono text-slate-900 break-all">
                  {user.referredBy || 'Direct Signup'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stats & History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Financial Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 font-medium mb-1">Total Available</p>
              <p className="text-xl font-bold text-slate-900">
                ৳{((user.walletBalance || 0) + (user.resellerBalance || 0)).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 font-medium mb-1">Total Earned</p>
              <p className="text-xl font-bold text-emerald-600">
                ৳{((user.totalEarned || 0) + (user.totalResellerEarned || 0)).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 font-medium mb-1">Total Withdrawn</p>
              <p className="text-xl font-bold text-blue-600">
                ৳{((user.totalWithdrawn || 0) + (user.totalResellerWithdrawn || 0)).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 font-medium mb-1">Total Orders</p>
              <p className="text-xl font-bold text-slate-900">
                {user.totalOrders || 0}
              </p>
            </div>
          </div>

          {/* Earning & Commission History */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-main" /> Commission & Earnings History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Order ID</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No earning history found for this user.</td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-slate-500">
                          {safeFormatDate(tx.createdAt, 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                            <Activity className="w-3.5 h-3.5 text-slate-400" /> {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          {tx.orderId || 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          ৳{tx.amount?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(tx.status)}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
