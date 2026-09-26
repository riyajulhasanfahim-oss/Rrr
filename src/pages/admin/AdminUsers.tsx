import React, { useEffect, useState, useMemo } from 'react';
import { rtdbGet, rtdbList, rtdbUpdate } from '../../lib/rtdb';
import { Search, Filter, Shield, ShieldAlert, CheckCircle, XCircle, MoreVertical, Eye, UserX, UserCheck, BadgeCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import VerifiedBadge from '../../components/ui/VerifiedBadge';
import { saveStoreToCache } from '../../services/storeCache';

const formatUserDate = (val: any) => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'MMM d, yyyy');
  } catch {
    return 'N/A';
  }
};

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const userMap = new Map<string, any>();

      // 1. Fetch from RTDB 'users'
      const rtdbUsers = await rtdbList<any>('users').catch(() => []);
      rtdbUsers.forEach(({ id, data }) => {
        if (!id || !data) return;
        userMap.set(id, {
          id,
          ...data,
          name: data.name || data.displayName || data.fullName || 'Unnamed User',
          email: data.email || '',
          phone: data.phone || data.mobileNumber || '',
          role: (data.role || 'customer').toLowerCase(),
          status: data.status || 'active'
        });
      });

      // 2. Fetch from RTDB 'resellers' to include any resellers not in users
      try {
        const rtdbResellers = await rtdbList<any>('resellers').catch(() => []);
        rtdbResellers.forEach(({ id, data }) => {
          if (!id || !data) return;
          const existing = userMap.get(id);
          if (!existing) {
            userMap.set(id, {
              id,
              ...data,
              name: data.fullName || data.name || 'Reseller ' + id.substring(0, 5),
              email: data.email || '',
              phone: data.mobileNumber || data.phone || '',
              role: 'reseller',
              status: data.status || 'active'
            });
          } else {
            existing.role = 'reseller';
            if (!existing.phone && data.mobileNumber) existing.phone = data.mobileNumber;
            if (data.isVerified || data.blueBadge || data.verificationBadge) {
              existing.isVerified = true;
              existing.blueBadge = true;
            }
          }
        });
      } catch (err) {
        console.warn('Error reading resellers for users list:', err);
      }

      // 3. Fetch from RTDB 'vendors' to include any vendors not in users
      try {
        const rtdbVendors = await rtdbList<any>('vendors').catch(() => []);
        rtdbVendors.forEach(({ id, data }) => {
          if (!id || !data) return;
          const existing = userMap.get(id);
          if (!existing) {
            userMap.set(id, {
              id,
              ...data,
              name: data.ownerName || data.name || data.fullName || 'Vendor ' + id.substring(0, 5),
              email: data.email || '',
              phone: data.mobileNumber || data.phone || '',
              role: 'vendor',
              status: data.status || 'active'
            });
          } else {
            existing.role = 'vendor';
            if (!existing.phone && data.mobileNumber) existing.phone = data.mobileNumber;
            if (data.isVerified || data.isVerifiedSeller || data.blueBadge || data.verificationStatus === 'verified') {
              existing.isVerified = true;
              existing.isVerifiedSeller = true;
              existing.blueBadge = true;
            }
          }
        });
      } catch (err) {
        console.warn('Error reading vendors for users list:', err);
      }

      setUsers(Array.from(userMap.values()));
    } catch (error) {
      console.error('Error fetching users from RTDB:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const isUserVerified = (u: any) => {
    return Boolean(
      u.isVerified ||
      u.verified ||
      u.verificationBadge ||
      u.blueBadge ||
      u.isBlueBadge ||
      u.verificationStatus === 'verified' ||
      u.isVerifiedSeller
    );
  };

  const toggleVerifiedBadge = async (user: any) => {
    try {
      setActionLoading(user.id);
      const currentVerified = isUserVerified(user);
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

      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...payload } : u));
      toast.success(newStatus ? 'Verified badge granted!' : 'Verified badge removed!');
    } catch (error) {
      console.error('Error toggling verified badge in RTDB:', error);
      toast.error('Failed to update verified badge');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleUserStatus = async (user: any) => {
    try {
      setActionLoading(user.id);
      const newStatus = user.status === 'inactive' ? 'active' : 'inactive';
      const payload = { status: newStatus, updatedAt: Date.now() };

      await Promise.allSettled([
        rtdbUpdate(`users/${user.id}`, payload),
        rtdbUpdate(`resellers/${user.id}`, payload),
        rtdbUpdate(`vendors/${user.id}`, payload)
      ]);

      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      toast.success(`User marked as ${newStatus}`);
    } catch (error) {
      console.error('Error updating status in RTDB:', error);
      toast.error('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const searchMatch = 
          (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.phone || '').includes(searchTerm) ||
          (user.id || '').includes(searchTerm) ||
          (user.referralId || '').toLowerCase().includes(searchTerm.toLowerCase());

        const uRole = (user.role || '').toLowerCase();
        const typeMatch = filterType === 'All' 
          ? true 
          : filterType === 'Verified'
            ? isUserVerified(user)
            : filterType === 'Reseller' 
              ? uRole === 'reseller' 
              : filterType === 'Vendor' 
                ? uRole === 'vendor' || uRole === 'seller'
                : filterType === 'Leadership'
                  ? Boolean(user.isMLMMember)
                  : uRole === 'customer' || !uRole;

        const statusMatch = filterStatus === 'All'
          ? true
          : filterStatus === 'Active'
            ? user.status !== 'inactive' && user.status !== 'suspended'
            : user.status === 'inactive' || user.status === 'suspended';

        return searchMatch && typeMatch && statusMatch;
      })
      .sort((a, b) => {
        const aVer = isUserVerified(a);
        const bVer = isUserVerified(b);
        if (aVer && !bVer) return -1;
        if (!aVer && bVer) return 1;
        return 0;
      });
  }, [users, searchTerm, filterType, filterStatus]);

  const verifiedUsersCount = useMemo(() => {
    return users.filter(u => isUserVerified(u)).length;
  }, [users]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all registered users on the platform.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Users</p>
          <p className="text-xl font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center bg-blue-50/20">
          <p className="text-xs text-blue-600 font-medium mb-1 flex items-center justify-center gap-1">
            <BadgeCheck className="w-3.5 h-3.5 text-blue-600" /> Verified Badges
          </p>
          <p className="text-xl font-bold text-blue-700">{verifiedUsersCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Customers</p>
          <p className="text-xl font-bold text-slate-700">
            {users.filter(u => !u.role || u.role === 'customer').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Resellers</p>
          <p className="text-xl font-bold text-emerald-600">
            {users.filter(u => u.role === 'reseller').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Vendors</p>
          <p className="text-xl font-bold text-purple-600">
            {users.filter(u => u.role === 'vendor').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between bg-slate-50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, email, phone, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
              {['All', 'Verified', 'Customer', 'Reseller', 'Vendor', 'Leadership'].map(type => (
                <button 
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    filterType === type 
                      ? type === 'Verified' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {type === 'Verified' && <BadgeCheck className="w-3.5 h-3.5 text-blue-300" />}
                  {type}
                </button>
              ))}
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
              {['All', 'Active', 'Inactive'].map(status => (
                <button 
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Balance</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
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
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const verified = isUserVerified(user);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors bg-white">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                              <span className="text-sm font-bold text-slate-400">
                                {(user.name || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900">{user.name || 'Unnamed User'}</p>
                              {verified && (
                                <VerifiedBadge size="xs" title="ভেরিফাইড ব্যাচ ইউজার" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono">ID: {user.id.substring(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-900">{user.email || 'No email'}</p>
                        <p className="text-xs text-slate-500">{user.phone || 'No phone'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            user.role === 'vendor' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'reseller' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {(user.role || 'customer').toUpperCase()}
                          </span>
                          {user.isMLMMember && (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                              MLM
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">৳{((user.walletBalance || 0) + (user.resellerBalance || 0)).toLocaleString()}</p>
                        <p className="text-xs text-slate-500">Earned: ৳{((user.totalEarned || 0) + (user.totalResellerEarned || 0)).toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatUserDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        {user.status === 'inactive' ? (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold bg-red-50 px-2 py-1 rounded-md">
                            <XCircle className="w-3.5 h-3.5" /> Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-1 rounded-md">
                            <CheckCircle className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Verified Badge */}
                          <button
                            onClick={() => toggleVerifiedBadge(user)}
                            disabled={actionLoading === user.id}
                            title={verified ? "Remove Verified Badge (RTDB)" : "Grant Verified Badge (RTDB)"}
                            className={`p-2 rounded-lg transition-colors border ${
                              verified 
                                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' 
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-300'
                            }`}
                          >
                            <BadgeCheck className="w-4 h-4" />
                          </button>

                          {/* Toggle Status */}
                          <button
                            onClick={() => toggleUserStatus(user)}
                            disabled={actionLoading === user.id}
                            title={user.status === 'inactive' ? "Activate User (RTDB)" : "Deactivate User (RTDB)"}
                            className={`p-2 rounded-lg transition-colors border ${
                              user.status === 'inactive'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {user.status === 'inactive' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>

                          {/* View Details */}
                          <Link 
                            to={`/admin/users/${user.id}`}
                            className="inline-flex items-center justify-center p-2 bg-slate-50 text-slate-600 hover:bg-primary-main hover:text-white rounded-lg transition-colors border border-slate-200 hover:border-primary-main"
                            title="View User Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
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
    </div>
  );
}
