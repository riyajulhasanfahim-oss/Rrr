import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbGet, rtdbUpdate, rtdbList } from '../../../lib/rtdb';
import { clearVendorLocationCache } from '../../../services/vendorLocationService';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Settings, 
  Store, 
  Bell, 
  Shield, 
  Truck, 
  CreditCard, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ToggleLeft,
  ToggleRight,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    storeStatus: 'active', // 'active' | 'vacation'
    vacationMessage: 'Our store is temporarily on vacation. We will be back soon!',
    codEnabled: true,
    minOrderAmount: '0',
    deliveryNote: 'Delivery inside Dhaka 2-3 days, outside Dhaka 3-5 days.',
    orderNotificationSMS: true,
    orderNotificationEmail: true,
    autoReplyCustomer: true,
    autoReplyText: 'Thank you for messaging our store! We will respond shortly.',
    returnPolicy: '7 days easy return for unused items with original packaging.',
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [vendorData, profileData] = await Promise.all([
        rtdbGet(`vendors/${user.uid}`),
        rtdbGet(`vendor_profiles/${user.uid}`)
      ]);

      const merged = { ...vendorData, ...profileData };
      if (merged.settings) {
        setSettings(prev => ({ ...prev, ...merged.settings }));
      } else if (merged.status) {
        setSettings(prev => ({ ...prev, storeStatus: merged.status === 'vacation' ? 'vacation' : 'active' }));
      }

      if (merged.isCodEnabled !== undefined) {
        setSettings(prev => ({ ...prev, codEnabled: Boolean(merged.isCodEnabled) }));
      } else if (merged.codEnabled !== undefined) {
        setSettings(prev => ({ ...prev, codEnabled: Boolean(merged.codEnabled) }));
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const updatePayload = {
        settings: settings,
        status: settings.storeStatus,
        codEnabled: settings.codEnabled,
        isCodEnabled: settings.codEnabled,
        updatedAt: Date.now()
      };

      await Promise.allSettled([
        rtdbUpdate(`vendors/${user.uid}`, updatePayload),
        rtdbUpdate(`vendor_profiles/${user.uid}`, updatePayload),
        rtdbUpdate(`stores/${user.uid}`, updatePayload),
        rtdbUpdate(`users/${user.uid}`, updatePayload)
      ]);

      // Clear memory cache so checkout immediately gets latest setting
      clearVendorLocationCache(user.uid);

      // Background sync of vendor products
      rtdbList('products', (p: any) => p?.vendorId === user.uid || p?.userId === user.uid || p?.vendor?.id === user.uid || p?.storeId === user.uid)
        .then(prods => {
          if (prods && prods.length > 0) {
            return Promise.allSettled(
              prods.map(p => rtdbUpdate(`products/${p.id}`, { isCodEnabled: settings.codEnabled, codEnabled: settings.codEnabled }))
            );
          }
        })
        .catch(err => console.warn('Product COD sync warning in settings:', err));

      toast.success('Store settings saved successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VendorLayout>
      <div className="max-w-4xl mx-auto pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-primary-main" />
              Vendor Store Settings
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Manage your store operations, policies, notifications, and operational preferences
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-primary-main border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Store Operational Status */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-2xs">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Store className="w-5 h-5 text-primary-main" />
                Store Operations Status
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800 block">
                      Store Availability
                    </span>
                    <span className="text-xs text-gray-500">
                      {settings.storeStatus === 'active' 
                        ? 'Your store is active and accepting new customer orders' 
                        : 'Your store is in Vacation Mode (orders paused)'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      storeStatus: prev.storeStatus === 'active' ? 'vacation' : 'active'
                    }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      settings.storeStatus === 'active' 
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    {settings.storeStatus === 'active' ? 'Online / Active' : 'Vacation Mode'}
                  </button>
                </div>

                {settings.storeStatus === 'vacation' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Vacation Announcement for Customers
                    </label>
                    <textarea
                      rows={2}
                      value={settings.vacationMessage}
                      onChange={(e) => setSettings(prev => ({ ...prev, vacationMessage: e.target.value }))}
                      className="w-full text-xs sm:text-sm p-3 border border-amber-200 bg-amber-50/50 rounded-lg focus:outline-none focus:border-primary-main"
                      placeholder="Enter a message to display to visitors while you are away..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Delivery Policies */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-2xs">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5 text-primary-main" />
                Payment & Delivery Options
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800 block">
                      Cash on Delivery (COD)
                    </span>
                    <span className="text-xs text-gray-500">
                      Allow customers to pay upon receiving products
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, codEnabled: !prev.codEnabled }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      settings.codEnabled ? 'bg-primary-main text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {settings.codEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Minimum Order Amount (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.minOrderAmount}
                      onChange={(e) => setSettings(prev => ({ ...prev, minOrderAmount: e.target.value }))}
                      className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-main"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Delivery Note / Estimated Time
                    </label>
                    <input
                      type="text"
                      value={settings.deliveryNote}
                      onChange={(e) => setSettings(prev => ({ ...prev, deliveryNote: e.target.value }))}
                      className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-main"
                      placeholder="e.g. 2-3 days inside Dhaka"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Store Return & Refund Policy
                  </label>
                  <textarea
                    rows={2}
                    value={settings.returnPolicy}
                    onChange={(e) => setSettings(prev => ({ ...prev, returnPolicy: e.target.value }))}
                    className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-main"
                    placeholder="Describe your return policy..."
                  />
                </div>
              </div>
            </div>

            {/* Notifications & Auto Reply */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-2xs">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-primary-main" />
                Alerts & Auto-Reply
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800 block">
                      New Order SMS Notifications
                    </span>
                    <span className="text-xs text-gray-500">
                      Receive instant SMS alert when a customer orders
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.orderNotificationSMS}
                    onChange={(e) => setSettings(prev => ({ ...prev, orderNotificationSMS: e.target.checked }))}
                    className="w-4 h-4 text-primary-main rounded"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800 block">
                      Customer Chat Auto-Reply
                    </span>
                    <span className="text-xs text-gray-500">
                      Automatically respond when a customer initiates a chat
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoReplyCustomer}
                    onChange={(e) => setSettings(prev => ({ ...prev, autoReplyCustomer: e.target.checked }))}
                    className="w-4 h-4 text-primary-main rounded"
                  />
                </div>

                {settings.autoReplyCustomer && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Auto-Reply Message
                    </label>
                    <textarea
                      rows={2}
                      value={settings.autoReplyText}
                      onChange={(e) => setSettings(prev => ({ ...prev, autoReplyText: e.target.value }))}
                      className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-main"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-primary-main hover:bg-sky-600 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </div>
    </VendorLayout>
  );
}
