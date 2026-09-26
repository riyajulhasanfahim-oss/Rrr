import React, { useEffect, useState, useMemo } from 'react';
import { rtdbGet, rtdbList, rtdbUpdate, rtdbRemove, rtdbSet } from '../../lib/rtdb';
import { Search, Filter, Eye, CheckCircle, XCircle, Store, Box, DollarSign, Activity, Trash2, Ban, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { isStorePlanVerified, saveStoreToCache, removeStoreFromCache, fetchOfficialStoresFromRTDB } from '../../services/storeCache';
import { 
  getVerifiedBadgeSettings, 
  calculateBadgeExpiry, 
  grantOrRenewVendorBadge, 
  revokeVendorBadge,
  getBadgeExpiryDetails
} from '../../services/verifiedBadgeService';
import VerifiedBadge from '../../components/ui/VerifiedBadge';

const formatVendorDate = (val: any) => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'PPP');
  } catch {
    return 'N/A';
  }
};

export default function AdminVendors() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingBadge, setTogglingBadge] = useState<string | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);

      const vendorMap = new Map<string, any>();

      // 1. Fetch vendors from RTDB 'vendors'
      const [rtdbVendors, rtdbProducts, rtdbOrders] = await Promise.all([
        rtdbList<any>('vendors').catch(() => []),
        rtdbList<any>('products').catch(() => []),
        rtdbList<any>('orders').catch(() => [])
      ]);

      // Calculate stats per vendor
      const productCounts: Record<string, number> = {};
      rtdbProducts.forEach(({ data }) => {
        if (!data) return;
        const vId = data.vendorId || data.vendor || data.sellerId;
        if (vId) productCounts[vId] = (productCounts[vId] || 0) + 1;
      });

      const orderCounts: Record<string, number> = {};
      const salesTotals: Record<string, number> = {};
      rtdbOrders.forEach(({ data }) => {
        if (!data) return;
        const vId = data.vendorId || data.vendor || data.sellerId;
        if (vId) {
          orderCounts[vId] = (orderCounts[vId] || 0) + 1;
          const status = (data.status || '').toLowerCase();
          if (status !== 'cancelled' && status !== 'rejected') {
            salesTotals[vId] = (salesTotals[vId] || 0) + (Number(data.total || data.amount) || 0);
          }
        }
      });

      rtdbVendors.forEach(({ id, data }) => {
        if (!id || !data) return;
        vendorMap.set(id, {
          id,
          ...data,
          name: data.ownerName || data.name || data.fullName || 'Unknown Owner',
          shopName: data.storeName || data.shopName || data.businessName || 'Unknown Shop',
          email: data.email || '',
          phone: data.mobileNumber || data.phone || '',
          paymentMethod: data.paymentMethod || 'N/A',
          transactionId: data.transactionId || 'N/A',
          address: data.address || 'N/A',
          whatsappNumber: data.whatsappNumber || 'N/A',
          facebookPage: data.facebookPage || 'N/A',
          status: data.status || 'pending',
          totalProducts: productCounts[id] ?? Number(data.totalProducts || 0),
          totalSales: salesTotals[id] ?? Number(data.totalSales || 0),
          totalOrders: orderCounts[id] ?? Number(data.totalOrders || 0),
          vendorData: data
        });
      });

      // 2. Also check RTDB 'users' for vendor role
      try {
        const rtdbUsers = await rtdbList<any>('users');
        rtdbUsers.forEach(({ id, data }) => {
          if (!id || !data) return;
          const role = (data.role || '').toLowerCase();
          if (role === 'vendor' || role === 'seller') {
            const existing = vendorMap.get(id);
            if (!existing) {
              vendorMap.set(id, {
                id,
                ...data,
                name: data.name || data.displayName || data.ownerName || 'Unknown Owner',
                shopName: data.shopName || data.storeName || data.businessName || 'Store ' + id.substring(0, 5),
                email: data.email || '',
                phone: data.phone || data.mobileNumber || '',
                paymentMethod: data.paymentMethod || 'N/A',
                transactionId: data.transactionId || 'N/A',
                address: data.address || 'N/A',
                whatsappNumber: data.whatsappNumber || 'N/A',
                facebookPage: data.facebookPage || 'N/A',
                status: data.status || 'active',
                totalProducts: productCounts[id] ?? Number(data.totalProducts || 0),
                totalSales: salesTotals[id] ?? Number(data.totalSales || 0),
                totalOrders: orderCounts[id] ?? Number(data.totalOrders || 0),
                vendorData: data
              });
            } else {
              if (!existing.phone && data.phone) existing.phone = data.phone;
              if (!existing.email && data.email) existing.email = data.email;
            }
          }
        });
      } catch (err) {
        console.warn('Error reading users for vendors:', err);
      }

      setVendors(Array.from(vendorMap.values()));
    } catch (error) {
      console.error('Error fetching vendors from RTDB:', error);
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const toggleVendorStatus = async (vendorId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'pending') {
        // Approve vendor
        await Promise.allSettled([
          rtdbUpdate(`vendors/${vendorId}`, { status: 'active', updatedAt: Date.now() }),
          rtdbUpdate(`vendor_profiles/${vendorId}`, { status: 'active', updatedAt: Date.now() }),
          rtdbUpdate(`users/${vendorId}`, { role: 'Vendor', status: 'active', updatedAt: Date.now() })
        ]);
        toast.success('Vendor approved successfully');
      } else {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        await Promise.allSettled([
          rtdbUpdate(`users/${vendorId}`, { status: newStatus, updatedAt: Date.now() }),
          rtdbUpdate(`vendors/${vendorId}`, { status: newStatus, updatedAt: Date.now() }),
          rtdbUpdate(`vendor_profiles/${vendorId}`, { status: newStatus, updatedAt: Date.now() })
        ]);
        toast.success(`Vendor ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
      }
      fetchVendors();
      setSelectedVendor(null);
    } catch (error) {
      console.error('Error updating vendor status:', error);
      toast.error('Failed to update status');
    }
  };

  const rejectVendor = async (vendorId: string) => {
    try {
      await Promise.allSettled([
        rtdbUpdate(`vendors/${vendorId}`, { status: 'rejected', updatedAt: Date.now() }),
        rtdbUpdate(`users/${vendorId}`, { role: 'Customer', status: 'active', updatedAt: Date.now() })
      ]);
      toast.success('Vendor rejected successfully');
      fetchVendors();
      setSelectedVendor(null);
    } catch (error) {
      console.error('Error rejecting vendor:', error);
      toast.error('Failed to reject vendor');
    }
  };

  const deleteVendor = async (vendorOrId: any) => {
    try {
      setIsDeleting(true);

      const targetId = typeof vendorOrId === 'string' ? vendorOrId : vendorOrId?.id;
      const vendorObj = typeof vendorOrId === 'object' && vendorOrId ? vendorOrId : (vendors.find(v => v.id === targetId) || {});
      const vendorEmail = (vendorObj.email || '').toLowerCase().trim();

      // Collect all candidate IDs linked to this vendor
      const candidateIds = new Set<string>();
      if (targetId) candidateIds.add(String(targetId).trim());
      if (vendorObj.id) candidateIds.add(String(vendorObj.id).trim());
      if (vendorObj.userId) candidateIds.add(String(vendorObj.userId).trim());
      if (vendorObj.vendorId) candidateIds.add(String(vendorObj.vendorId).trim());
      if (vendorObj.storeId) candidateIds.add(String(vendorObj.storeId).trim());
      if (vendorObj.vendorData?.userId) candidateIds.add(String(vendorObj.vendorData.userId).trim());
      if (vendorObj.vendorData?.storeId) candidateIds.add(String(vendorObj.vendorData.storeId).trim());
      if (vendorObj.vendorData?.vendorId) candidateIds.add(String(vendorObj.vendorData.vendorId).trim());

      // If vendor has an email, find matching user account in RTDB users
      if (vendorEmail) {
        try {
          const allUsers = await rtdbList<any>('users');
          allUsers.forEach(({ id, data }) => {
            if (data && (data.email || '').toLowerCase().trim() === vendorEmail) {
              candidateIds.add(id);
            }
          });
        } catch (_) {}
      }

      const idList = Array.from(candidateIds);
      const now = Date.now();

      // 1. Remove all vendor nodes from RTDB for all candidate IDs
      const rtdbOperations: Promise<any>[] = [];
      for (const id of idList) {
        rtdbOperations.push(
          rtdbRemove(`vendors/${id}`),
          rtdbRemove(`stores/${id}`),
          rtdbRemove(`vendor_profiles/${id}`),
          rtdbRemove(`vendor_themes/${id}`),
          rtdbRemove(`vendor_settings/${id}`),
          rtdbRemove(`vendor_verification/${id}`),
          rtdbRemove(`vendor_badges/${id}`),
          rtdbRemove(`vendor_products/${id}`),
          rtdbRemove(`vendor_custom_domains/${id}`),
          rtdbRemove(`resellers/${id}`),
          rtdbSet(`deleted_vendors/${id}`, {
            id,
            email: vendorEmail || '',
            deletedAt: now,
            deletedBy: 'admin'
          }),
          rtdbUpdate(`users/${id}`, {
            role: 'Customer',
            isVendor: false,
            hasActiveVendor: false,
            vendorId: null,
            shopName: null,
            storeName: null,
            businessName: null,
            updatedAt: now
          })
        );
      }
      await Promise.allSettled(rtdbOperations);

      // 2. Remove all products belonging to any candidate ID
      try {
        const allProds = await rtdbList<any>('products');
        const prodsToDelete = allProds.filter(({ data }) => {
          if (!data) return false;
          const vId = String(data.vendorId || data.storeId || data.sellerId || data.vendor?.id || '').trim();
          return candidateIds.has(vId);
        });
        if (prodsToDelete.length > 0) {
          await Promise.allSettled(prodsToDelete.map(p => rtdbRemove(`products/${p.id}`)));
        }
      } catch (prodErr) {
        console.warn('Error removing vendor products:', prodErr);
      }

      // 3. Call backend endpoint to purge static server data
      try {
        await fetch('/api/vendor/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendorId: targetId, candidateIds: idList })
        });
      } catch (_) {}

      // 4. Purge from local storeCache and dispatch global deletion events for all IDs
      idList.forEach(id => removeStoreFromCache(id));

      // 5. Force refresh the official stores cache
      await fetchOfficialStoresFromRTDB(true);

      toast.success('ভেন্ডর এবং স্টোর সফলভাবে মুছে ফেলা হয়েছে');
      setVendors(prev => prev.filter(v => !candidateIds.has(v.id)));
      setSelectedVendor(null);
      setVendorToDelete(null);
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast.error('Failed to delete vendor');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleVerifiedBadge = async (vendor: any) => {
    try {
      setTogglingBadge(vendor.id);
      const currentVerified = isStorePlanVerified(vendor);
      const newStatus = !currentVerified;

      if (newStatus) {
        const settings = await getVerifiedBadgeSettings();
        const res = await grantOrRenewVendorBadge(vendor.id, {
          months: settings.validityMonths,
          price: settings.price,
          paymentMethod: 'admin_panel',
          sellerName: vendor.ownerName || vendor.name,
          storeName: vendor.storeName || vendor.shopName
        });
        setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, ...res.payload } : v));
        if (selectedVendor && selectedVendor.id === vendor.id) {
          setSelectedVendor({ ...selectedVendor, ...res.payload });
        }
        toast.success(`ভেন্ডর ভেরিফাইড ব্যাজ অনুমোদন দেওয়া হয়েছে (${settings.validityMonths} মাস মেয়াদী)!`);
      } else {
        const res = await revokeVendorBadge(vendor.id);
        setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, ...res.payload } : v));
        if (selectedVendor && selectedVendor.id === vendor.id) {
          setSelectedVendor({ ...selectedVendor, ...res.payload });
        }
        toast.success('ভেন্ডর ভেরিফাইড ব্যাজ বাতিল করা হয়েছে!');
      }
    } catch (error) {
      console.error('Error toggling vendor verified badge in RTDB:', error);
      toast.error('Failed to update verified badge');
    } finally {
      setTogglingBadge(null);
    }
  };

  const filteredVendors = useMemo(() => {
    return vendors
      .filter(v => {
        const searchMatch = 
          v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.shopName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.id?.toLowerCase().includes(searchTerm.toLowerCase());

        const isVerified = isStorePlanVerified(v);
        const filterMatch = 
          statusFilter === 'All' ? true :
          statusFilter === 'Verified' ? isVerified :
          statusFilter === 'Active' ? v.status === 'active' :
          statusFilter === 'Pending' ? v.status === 'pending' :
          statusFilter === 'Suspended' ? v.status === 'suspended' || v.status === 'inactive' :
          true;

        return searchMatch && filterMatch;
      })
      .sort((a, b) => {
        const aVer = isStorePlanVerified(a);
        const bVer = isStorePlanVerified(b);
        if (aVer && !bVer) return -1;
        if (!aVer && bVer) return 1;
        return 0;
      });
  }, [vendors, searchTerm, statusFilter]);

  const verifiedVendorsCount = useMemo(() => {
    return vendors.filter(v => isStorePlanVerified(v)).length;
  }, [vendors]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendors Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all registered vendors and their stores (100% RTDB Realtime Database).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Vendors</p>
          <p className="text-xl font-bold text-slate-900">{vendors.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center bg-blue-50/20">
          <p className="text-xs text-blue-600 font-medium mb-1 flex items-center justify-center gap-1">
            <BadgeCheck className="w-3.5 h-3.5 text-blue-600" /> Verified Badges
          </p>
          <p className="text-xl font-bold text-blue-700">{verifiedVendorsCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Active Stores</p>
          <p className="text-xl font-bold text-emerald-600">
            {vendors.filter(v => v.status === 'active').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Pending Approval</p>
          <p className="text-xl font-bold text-amber-600">
            {vendors.filter(v => v.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Suspended</p>
          <p className="text-xl font-bold text-rose-600">
            {vendors.filter(v => v.status === 'suspended' || v.status === 'inactive').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search vendors by name, email, or shop..."
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
                <th className="px-6 py-4 font-semibold">Vendor & Shop</th>
                <th className="px-6 py-4 font-semibold">Contact Info</th>
                <th className="px-6 py-4 font-semibold text-center">Products</th>
                <th className="px-6 py-4 font-semibold text-center">Sales/Orders</th>
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
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No vendors found.</td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => {
                  const isVerified = isStorePlanVerified(vendor);
                  return (
                    <tr key={vendor.id} className="hover:bg-slate-50 transition-colors bg-white">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Store className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900">{vendor.shopName}</p>
                              {isVerified && (
                                <VerifiedBadge size="xs" title="Verified Store (RTDB)" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{vendor.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-900 font-medium">{vendor.email}</p>
                        <p className="text-xs text-slate-500">{vendor.phone || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-semibold text-xs">
                          <Box className="w-3.5 h-3.5" /> {vendor.totalProducts}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-sm">
                            ৳{vendor.totalSales?.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500">{vendor.totalOrders} Orders</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${vendor.status === 'active' ? 'bg-emerald-100 text-emerald-700' : vendor.status === 'pending' ? 'bg-amber-100 text-amber-700' : vendor.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-red-100 text-red-700'}`}>
                          {vendor.status === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> : vendor.status === 'pending' ? <Activity className="w-3.5 h-3.5" /> : vendor.status === 'rejected' ? <Ban className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {vendor.status === 'active' ? 'Active' : vendor.status === 'pending' ? 'Pending' : vendor.status === 'rejected' ? 'Rejected' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Verified Badge */}
                          <button 
                            onClick={() => toggleVerifiedBadge(vendor)}
                            disabled={togglingBadge === vendor.id}
                            className={`p-2 rounded-lg transition-colors border ${
                              isVerified 
                                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' 
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-300'
                            }`}
                            title={isVerified ? "Remove Verified Badge (RTDB)" : "Grant Verified Badge (RTDB)"}
                          >
                            <BadgeCheck className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => setSelectedVendor(vendor)}
                            className="p-2 rounded-lg text-slate-400 hover:text-primary-main hover:bg-sky-50 transition-colors border border-transparent hover:border-slate-200"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => toggleVendorStatus(vendor.id, vendor.status)}
                            className={`p-2 rounded-lg transition-colors ${vendor.status === 'active' ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                            title={vendor.status === 'pending' ? "Approve Vendor" : vendor.status === 'active' ? "Suspend Vendor" : "Activate Vendor"}
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          {vendor.status === 'pending' && (
                            <button 
                              onClick={() => rejectVendor(vendor.id)}
                              className="p-2 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Reject Vendor"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => setVendorToDelete(vendor)}
                            className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Vendor"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Vendor Details Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-primary-main" /> Vendor Details
              </h2>
              <button onClick={() => setSelectedVendor(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl">
                  {selectedVendor.shopName?.charAt(0) || 'V'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedVendor.shopName}</h3>
                  <p className="text-sm text-slate-500">Owner: {selectedVendor.name}</p>
                </div>
                <div className="ml-auto">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${selectedVendor.status === 'active' ? 'bg-emerald-100 text-emerald-700' : selectedVendor.status === 'pending' ? 'bg-amber-100 text-amber-700' : selectedVendor.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-red-100 text-red-700'}`}>
                    {selectedVendor.status === 'active' ? 'Active Account' : selectedVendor.status === 'pending' ? 'Pending Approval' : selectedVendor.status === 'rejected' ? 'Rejected Application' : 'Suspended Account'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium mb-1">Total Sales</p>
                  <p className="text-lg font-bold text-emerald-600">৳{selectedVendor.totalSales?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium mb-1">Total Orders</p>
                  <p className="text-lg font-bold text-sky-600">{selectedVendor.totalOrders}</p>
                </div>
                <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium mb-1">Products</p>
                  <p className="text-lg font-bold text-purple-600">{selectedVendor.totalProducts}</p>
                </div>
                <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium mb-1">Wallet Balance</p>
                  <p className="text-lg font-bold text-slate-900">৳{selectedVendor.balance || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Contact Information</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Email Address</span>
                      <span className="font-medium text-slate-900">{selectedVendor.email}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Mobile Number</span>
                      <span className="font-medium text-slate-900">{selectedVendor.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">WhatsApp Number</span>
                      <span className="font-medium text-slate-900">{selectedVendor.whatsappNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Facebook Page</span>
                      <span className="font-medium text-slate-900 truncate max-w-[150px]" title={selectedVendor.facebookPage}>{selectedVendor.facebookPage !== 'N/A' ? <a href={selectedVendor.facebookPage} target="_blank" rel="noreferrer" className="text-primary-main hover:underline">Link</a> : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Joined Date</span>
                      <span className="font-medium text-slate-900">
                        {formatVendorDate(selectedVendor.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-col py-2 border-b border-slate-50 gap-1">
                      <span className="text-slate-500">Full Address</span>
                      <span className="font-medium text-slate-900 text-right">{selectedVendor.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Payment Details</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Payment Method</span>
                      <span className="font-bold text-slate-900 uppercase">{selectedVendor.paymentMethod || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Transaction ID</span>
                      <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded">{selectedVendor.transactionId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                      <span className="text-slate-500">Registration Fee</span>
                      <span className="font-bold text-emerald-600">৳{selectedVendor.registrationFee || 300}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center gap-3">
              <div className="flex flex-wrap gap-2">
                {selectedVendor.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => toggleVendorStatus(selectedVendor.id, selectedVendor.status)} 
                      className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve Vendor
                    </button>
                    <button 
                      onClick={() => rejectVendor(selectedVendor.id)} 
                      className="px-6 py-2 bg-rose-100 text-rose-700 rounded-xl font-bold hover:bg-rose-200 transition-colors flex items-center gap-2"
                    >
                      <Ban className="w-4 h-4" /> Reject Vendor
                    </button>
                  </>
                )}
                <button
                  onClick={() => toggleVerifiedBadge(selectedVendor)}
                  disabled={togglingBadge === selectedVendor.id}
                  className={`px-5 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 border ${
                    isStorePlanVerified(selectedVendor)
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:text-blue-600 hover:border-blue-200'
                  }`}
                >
                  <BadgeCheck className="w-4 h-4 text-blue-600" />
                  {isStorePlanVerified(selectedVendor) ? 'Revoke Badge (RTDB)' : 'Grant Badge (RTDB)'}
                </button>
                {selectedVendor.status === 'active' && (
                  <button 
                    onClick={() => toggleVendorStatus(selectedVendor.id, selectedVendor.status)} 
                    className="px-6 py-2 bg-amber-100 text-amber-700 rounded-xl font-bold hover:bg-amber-200 transition-colors flex items-center gap-2"
                  >
                    <Activity className="w-4 h-4" /> Suspend Vendor
                  </button>
                )}
                {selectedVendor.status === 'suspended' && (
                  <button 
                    onClick={() => toggleVendorStatus(selectedVendor.id, selectedVendor.status)} 
                    className="px-6 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold hover:bg-emerald-200 transition-colors flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Reactivate Vendor
                  </button>
                )}
                <button 
                  onClick={() => setVendorToDelete(selectedVendor)} 
                  className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete Vendor
                </button>
              </div>
              <button onClick={() => setSelectedVendor(null)} className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              ভেন্ডর মুছে ফেলতে চান?
            </h3>
            <p className="text-slate-600 text-sm text-center mb-6 leading-relaxed">
              আপনি কি নিশ্চিত যে <span className="font-semibold text-slate-800">"{vendorToDelete.shopName || vendorToDelete.name}"</span> ভেন্ডরটিকে ডিলিট করতে চান?
              <br />
              <span className="text-xs text-red-500 mt-1 block">
                ভেন্ডর ডিলিট করলে ইউজারদের সাইট থেকে এই ভেন্ডরের স্টোর এবং প্রোডাক্ট সম্পূর্ণ মুছে যাবে।
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setVendorToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors text-sm disabled:opacity-50 cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                onClick={() => deleteVendor(vendorToDelete)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    মুছে ফেলা হচ্ছে...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    হ্যাঁ, ডিলিট করুন
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
