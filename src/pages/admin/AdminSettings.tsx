import React, { useState, useEffect } from 'react';
import { rtdbGet, rtdbSet, rtdbPush } from '../../lib/rtdb';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Settings, Save, AlertCircle, Shield, CreditCard, ShoppingCart, Users, Briefcase, Bell, HardDrive, DollarSign, Activity, FileText, Wallet, Store, ArrowRight, ExternalLink, Database, Eye, EyeOff, CheckCircle2, Globe, Key, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminDomainSettings from './AdminDomainSettings';
import AdminFirebaseSettings from './AdminFirebaseSettings';

export default function AdminSettings() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [showSofolXKey, setShowSofolXKey] = useState(false);
  const [showSofolXDeviceKey, setShowSofolXDeviceKey] = useState(false);

  // Define states for all sections
  const [generalSettings, setGeneralSettings] = useState({
    websiteName: 'RJ WORLD BD',
    websiteDescription: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    websiteStatus: 'active'
  });

  const [resellerSettings, setResellerSettings] = useState({
    systemEnabled: true,
    registrationEnabled: true,
    pricingEnabled: true,
    orderingEnabled: true
  });

  const [mlmSettings, setMlmSettings] = useState({
    systemEnabled: true,
    maxLevels: 5,
    referralEnabled: true
  });

  const [commissionSettings, setCommissionSettings] = useState({
    mlmCommissionEnabled: true,
    productSharingEnabled: true,
    resellerCommissionEnabled: true
  });

  const [withdrawalSettings, setWithdrawalSettings] = useState({
    minWithdrawalAmount: 100,
    maxWithdrawalAmount: 25000,
    withdrawalFee: 10,
    withdrawalsEnabled: true,
    bkashEnabled: true,
    nagadEnabled: true,
    rocketEnabled: true
  });

  const [paymentSettings, setPaymentSettings] = useState({
    codEnabled: true,
    sofolxEnabled: true,
    sofolxBrandKey: 'Dqvx0qo2gzssXuMv9XOgez6LnaRylmvhQLVT9BV4DLVuERH2DK',
    sofolxDeviceKey: 'bl5mF3yx6kh7d8dBmW7qcJgQzcsFAo4LyVQG5E7A',
    sofolxDeviceName: 'nexg n6',
    sofolxBaseUrl: 'https://pay.sofolx.com',
    sofolxSandboxMode: false
  });

  const [orderSettings, setOrderSettings] = useState({
    orderingEnabled: true,
    autoCancelEnabled: false,
    autoCancelHours: 24,
    returnEnabled: true,
    refundEnabled: true,
    baseDeliveryCharge: 60,
    outsideDeliveryCharge: 120
  });

  const [vendorSettings, setVendorSettings] = useState({
    registrationEnabled: true,
    autoApproveVendor: false,
    autoApproveProduct: false,
    orderingEnabled: true,
    settlementDays: 3,
    verifiedSellerPrice: 100,
    verifiedPlanMonths: 2
  });

  const [googleDriveSettings, setGoogleDriveSettings] = useState({
    connected: false,
    connectedEmail: '',
    folderId: '',
    authStatus: 'Not Configured',
    apiConfigStatus: 'Not Configured'
  });

  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeoutHours: 24,
    requireTwoFactor: false,
    maxFailedLogins: 5,
    activityLogging: true
  });

  const [notificationSettings, setNotificationSettings] = useState({
    newOrder: true,
    newWithdrawal: true,
    newUser: true,
    newVendor: true,
    newReseller: true,
    commissionGenerated: true,
    returnRequest: true,
    refundRequest: true
  });

  // Track original values to save history
  const [originalValues, setOriginalValues] = useState<any>({});

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const fetchAllSettings = async () => {
    try {
      setLoading(true);
      const settingsNodes = [
        { id: 'general', setter: setGeneralSettings },
        { id: 'reseller', setter: setResellerSettings },
        { id: 'mlm', setter: setMlmSettings },
        { id: 'commission', setter: setCommissionSettings },
        { id: 'withdrawals', setter: setWithdrawalSettings },
        { id: 'payment', setter: setPaymentSettings },
        { id: 'order', setter: setOrderSettings },
        { id: 'vendor', setter: setVendorSettings },
        { id: 'googleDrive', setter: setGoogleDriveSettings },
        { id: 'security', setter: setSecuritySettings },
        { id: 'notification', setter: setNotificationSettings }
      ];

      const newOriginals: any = {};

      for (const node of settingsNodes) {
        const data = await rtdbGet<any>(`settings/${node.id}`);
        if (data) {
          node.setter((prev: any) => ({ ...prev, ...data }));
          newOriginals[node.id] = data;
        }
      }

      // Fetch active SofolX gateway status from server
      try {
        const gatewayRes = await fetch('/api/payment/gateways-status');
        if (gatewayRes.ok) {
          const gData = await gatewayRes.json();
          if (gData.sofolx) {
            setPaymentSettings(prev => ({
              ...prev,
              sofolxEnabled: gData.sofolx.enabled ?? prev.sofolxEnabled,
              sofolxBaseUrl: gData.sofolx.baseUrl || prev.sofolxBaseUrl,
              sofolxSandboxMode: gData.sofolx.isSandbox ?? prev.sofolxSandboxMode,
              sofolxBrandKey: prev.sofolxBrandKey || 'Dqvx0qo2gzssXuMv9XOgez6LnaRylmvhQLVT9BV4DLVuERH2DK',
              sofolxDeviceKey: prev.sofolxDeviceKey || 'bl5mF3yx6kh7d8dBmW7qcJgQzcsFAo4LyVQG5E7A',
              sofolxDeviceName: gData.sofolx.deviceName || prev.sofolxDeviceName || 'nexg n6'
            }));
          }
        }
      } catch (err) {
        console.warn('Could not fetch gateway status:', err);
      }

      setOriginalValues(newOriginals);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (sectionId: string, currentData: any, originalData: any) => {
    try {
      setSaving(true);
      
      // Basic validation
      if (sectionId === 'withdrawals') {
        if (currentData.minWithdrawalAmount < 0 || currentData.maxWithdrawalAmount < 0 || currentData.withdrawalFee < 0) {
          toast.error("Withdrawal amounts cannot be negative");
          return;
        }
      }
      if (sectionId === 'order') {
        if (currentData.baseDeliveryCharge < 0 || currentData.outsideDeliveryCharge < 0) {
          toast.error("Delivery charges cannot be negative");
          return;
        }
      }

      await rtdbSet(`settings/${sectionId}`, currentData);

      // If updating payment, also sync directly with backend server
      if (sectionId === 'payment') {
        try {
          await fetch('/api/admin/payment-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandKey: currentData.sofolxBrandKey || '',
              deviceKey: currentData.sofolxDeviceKey || '',
              deviceName: currentData.sofolxDeviceName || '',
              baseUrl: currentData.sofolxBaseUrl || 'https://pay.sofolx.com',
              enabled: currentData.sofolxEnabled ?? true,
              isSandbox: currentData.sofolxSandboxMode ?? false
            })
          });
        } catch (apiErr) {
          console.warn('Backend payment settings update warning:', apiErr);
        }
      }

      // If updating vendor, also sync verified badge global settings
      if (sectionId === 'vendor') {
        const price = Number(currentData.verifiedSellerPrice) || 100;
        const months = Number(currentData.verifiedPlanMonths) || 2;
        try {
          await Promise.allSettled([
            rtdbSet('settings/verifiedBadge', {
              price,
              validityMonths: months,
              updatedAt: Date.now(),
              updatedBy: user?.email || 'admin'
            }),
            rtdbSet('settings/appConfig', {
              verifiedSellerPrice: price,
              verifiedPlanMonths: months,
              updatedAt: Date.now()
            })
          ]);
        } catch (syncErr) {
          console.warn('Sync verifiedBadge settings warning:', syncErr);
        }
      }

      // Save History if there are changes
      const changes: any = {};
      let hasChanges = false;
      
      Object.keys(currentData).forEach(key => {
        const oldVal = originalData ? originalData[key] : undefined;
        const newVal = currentData[key];
        
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes[key] = { old: oldVal, new: newVal };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        await rtdbPush('settingsHistory', {
          section: sectionId,
          changes,
          changedBy: userData?.name || user?.email || 'Admin',
          adminId: user?.uid,
          timestamp: new Date().toISOString()
        });
      }

      // Update original tracking
      setOriginalValues((prev: any) => ({
        ...prev,
        [sectionId]: { ...currentData }
      }));

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: FileText },
    { id: 'firebase', label: 'Firebase & DB', icon: Database },
    { id: 'domain', label: 'Domain Settings', icon: Globe },
    { id: 'reseller', label: 'Reseller', icon: Users },
    { id: 'mlm', label: 'Leadership', icon: Activity },
    { id: 'commission', label: 'Commissions', icon: DollarSign },
    { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
    { id: 'payment', label: 'Payments', icon: CreditCard },
    { id: 'order', label: 'Orders', icon: ShoppingCart },
    { id: 'vendor', label: 'Vendors', icon: Store },
    { id: 'googleDrive', label: 'Google Drive', icon: HardDrive },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notification', label: 'Notifications', icon: Bell }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage all business configurations and platform parameters.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-6">
            <div className="p-2 space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-primary-50 text-primary-main' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-primary-main' : 'text-slate-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            
            {/* General Settings */}
            {activeTab === 'general' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">General Settings</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Website Name</label>
                      <input 
                        type="text"
                        value={generalSettings.websiteName}
                        onChange={e => setGeneralSettings({...generalSettings, websiteName: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Website Status</label>
                      <select 
                        value={generalSettings.websiteStatus}
                        onChange={e => setGeneralSettings({...generalSettings, websiteStatus: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                      >
                        <option value="active">Active</option>
                        <option value="maintenance">Maintenance Mode</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Contact Email</label>
                      <input 
                        type="email"
                        value={generalSettings.contactEmail}
                        onChange={e => setGeneralSettings({...generalSettings, contactEmail: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Contact Phone</label>
                      <input 
                        type="text"
                        value={generalSettings.contactPhone}
                        onChange={e => setGeneralSettings({...generalSettings, contactPhone: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                      <input 
                        type="text"
                        value={generalSettings.address}
                        onChange={e => setGeneralSettings({...generalSettings, address: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button onClick={() => handleSave('general', generalSettings, originalValues.general)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Domain Settings */}
            {activeTab === 'firebase' && (
              <div>
                <AdminFirebaseSettings />
              </div>
            )}

            {/* Domain Settings */}
            {activeTab === 'domain' && (
              <div className="p-2 sm:p-6">
                <AdminDomainSettings />
              </div>
            )}

            {/* Withdrawals */}
            {activeTab === 'withdrawals' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Withdrawal Configuration</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Minimum Withdrawal (৳)</label>
                      <input type="number" value={withdrawalSettings.minWithdrawalAmount} onChange={e => setWithdrawalSettings({...withdrawalSettings, minWithdrawalAmount: Number(e.target.value)})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Maximum Withdrawal (৳)</label>
                      <input type="number" value={withdrawalSettings.maxWithdrawalAmount} onChange={e => setWithdrawalSettings({...withdrawalSettings, maxWithdrawalAmount: Number(e.target.value)})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Withdrawal Fee (৳)</label>
                      <input type="number" value={withdrawalSettings.withdrawalFee} onChange={e => setWithdrawalSettings({...withdrawalSettings, withdrawalFee: Number(e.target.value)})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                    </div>
                  </div>
                  <hr className="border-slate-100" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={withdrawalSettings.withdrawalsEnabled} onChange={e => setWithdrawalSettings({...withdrawalSettings, withdrawalsEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                      <div><p className="font-semibold text-slate-900">Enable Withdrawals</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={withdrawalSettings.bkashEnabled} onChange={e => setWithdrawalSettings({...withdrawalSettings, bkashEnabled: e.target.checked})} className="w-5 h-5 rounded text-pink-600 focus:ring-pink-600" />
                      <div><p className="font-semibold text-slate-900">bKash Method</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={withdrawalSettings.nagadEnabled} onChange={e => setWithdrawalSettings({...withdrawalSettings, nagadEnabled: e.target.checked})} className="w-5 h-5 rounded text-orange-600 focus:ring-orange-600" />
                      <div><p className="font-semibold text-slate-900">Nagad Method</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={withdrawalSettings.rocketEnabled} onChange={e => setWithdrawalSettings({...withdrawalSettings, rocketEnabled: e.target.checked})} className="w-5 h-5 rounded text-purple-600 focus:ring-purple-600" />
                      <div><p className="font-semibold text-slate-900">Rocket Method</p></div>
                    </label>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button onClick={() => handleSave('withdrawals', withdrawalSettings, originalValues.withdrawals)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reseller */}
            {activeTab === 'reseller' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Reseller Settings</h2>
                </div>
                <div className="p-6 space-y-4">
                   <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={resellerSettings.systemEnabled} onChange={e => setResellerSettings({...resellerSettings, systemEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                      <div><p className="font-semibold text-slate-900">Enable Reseller System</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={resellerSettings.registrationEnabled} onChange={e => setResellerSettings({...resellerSettings, registrationEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                      <div><p className="font-semibold text-slate-900">Enable Reseller Registration</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={resellerSettings.pricingEnabled} onChange={e => setResellerSettings({...resellerSettings, pricingEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                      <div><p className="font-semibold text-slate-900">Enable Reseller Pricing Rules</p></div>
                    </label>
                    <div className="flex justify-end pt-4">
                    <button onClick={() => handleSave('reseller', resellerSettings, originalValues.reseller)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MLM Settings */}
            {activeTab === 'mlm' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Leadership Settings</h2>
                </div>
                <div className="p-6 space-y-4">
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={mlmSettings.systemEnabled} onChange={e => setMlmSettings({...mlmSettings, systemEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Enable Leadership System</p></div>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Maximum Leadership Levels</label>
                    <input type="number" value={mlmSettings.maxLevels} onChange={e => setMlmSettings({...mlmSettings, maxLevels: Number(e.target.value)})} className="w-full md:w-1/3 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                  </div>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={mlmSettings.referralEnabled} onChange={e => setMlmSettings({...mlmSettings, referralEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Enable Referral Program</p></div>
                  </label>
                  <div className="flex justify-end pt-4">
                    <button onClick={() => handleSave('mlm', mlmSettings, originalValues.mlm)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Commissions */}
            {activeTab === 'commission' && (
               <div>
               <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                 <DollarSign className="w-5 h-5 text-slate-700" />
                 <h2 className="text-lg font-bold text-slate-900">Commission Settings</h2>
               </div>
               <div className="p-6 space-y-4">
                 <div className="bg-yellow-50 p-4 rounded-xl flex items-start gap-3 border border-yellow-100">
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      Changes here only apply to future transactions. Historical commission data will remain unaffected.
                    </p>
                  </div>
                 <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                   <input type="checkbox" checked={commissionSettings.mlmCommissionEnabled} onChange={e => setCommissionSettings({...commissionSettings, mlmCommissionEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                   <div><p className="font-semibold text-slate-900">Leadership Commission</p></div>
                 </label>
                 <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                   <input type="checkbox" checked={commissionSettings.productSharingEnabled} onChange={e => setCommissionSettings({...commissionSettings, productSharingEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                   <div><p className="font-semibold text-slate-900">Product Sharing Commission</p></div>
                 </label>
                 <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                   <input type="checkbox" checked={commissionSettings.resellerCommissionEnabled} onChange={e => setCommissionSettings({...commissionSettings, resellerCommissionEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                   <div><p className="font-semibold text-slate-900">Reseller Commission</p></div>
                 </label>
                 <div className="flex justify-end pt-4">
                   <button onClick={() => handleSave('commission', commissionSettings, originalValues.commission)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                     {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                   </button>
                 </div>
               </div>
             </div>
            )}

            {/* Payment Settings */}
            {activeTab === 'payment' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-slate-700" />
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Payment Gateway Settings</h2>
                      <p className="text-xs text-slate-500">Configure SofolX Automatic Payment Gateway and Cash on Delivery</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                    paymentSettings.sofolxEnabled && paymentSettings.sofolxBrandKey
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : paymentSettings.sofolxEnabled
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {paymentSettings.sofolxEnabled && paymentSettings.sofolxBrandKey
                      ? 'SofolX Active'
                      : paymentSettings.sofolxEnabled
                      ? 'Brand Key Required'
                      : 'Disabled'}
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {/* SofolX Gateway Configuration Card */}
                  <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-xs space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-base shadow-xs">
                          SX
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">SofolX Payment Gateway</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Official Integration
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Automatic checkout gateway for bKash, Nagad, Rocket, Upay, Cards & Net Banking
                          </p>
                        </div>
                      </div>

                      {/* Enable Switch */}
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <span className="text-xs font-semibold text-slate-700">
                          {paymentSettings.sofolxEnabled ? 'Gateway Enabled' : 'Gateway Disabled'}
                        </span>
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={paymentSettings.sofolxEnabled} 
                            onChange={e => setPaymentSettings({ ...paymentSettings, sofolxEnabled: e.target.checked })} 
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </div>
                      </label>
                    </div>

                    {/* Brand Key Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-800">
                          Brand Key <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] text-slate-500">
                          From SofolX Merchant Portal &rarr; Brands
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type={showSofolXKey ? 'text' : 'password'}
                          value={paymentSettings.sofolxBrandKey}
                          onChange={e => setPaymentSettings({ ...paymentSettings, sofolxBrandKey: e.target.value })}
                          placeholder="e.g. 6a2b10909f5014d231900c512173f5d2"
                          className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <button
                          type="button"
                          onClick={() => setShowSofolXKey(!showSofolXKey)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          title={showSofolXKey ? 'Hide key' : 'Show key'}
                        >
                          {showSofolXKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        SofolX authentication uses your <strong>Brand Key</strong> and connected <strong>Device</strong> for automated SMS payment notifications.
                      </p>
                    </div>

                    {/* Connected Device (SMS Gateway) Card */}
                    <div className="p-4 border border-emerald-200 rounded-xl bg-gradient-to-r from-emerald-50/70 to-teal-50/50 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900">Connected Device (SMS Gateway)</h4>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Connected & Active
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Android Device forwarding SMS for instant automated verification (bKash, Nagad, Rocket)
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Device Name */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">Device Name</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={paymentSettings.sofolxDeviceName}
                              onChange={e => setPaymentSettings({ ...paymentSettings, sofolxDeviceName: e.target.value })}
                              placeholder="nexg n6"
                              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                            <Smartphone className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                          <p className="text-[10px] text-slate-400">Model: {paymentSettings.sofolxDeviceName || 'nexg n6'}</p>
                        </div>

                        {/* Device Key */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-bold text-slate-700">Device Key</label>
                            <span className="text-[10px] text-slate-400">SofolX Device App Key</span>
                          </div>
                          <div className="relative">
                            <input
                              type={showSofolXDeviceKey ? 'text' : 'password'}
                              value={paymentSettings.sofolxDeviceKey}
                              onChange={e => setPaymentSettings({ ...paymentSettings, sofolxDeviceKey: e.target.value })}
                              placeholder="bl5mF3yx6kh7d8dBmW7qcJgQzcsFAo4LyVQG5E7A"
                              className="w-full pl-9 pr-10 py-2 rounded-lg border border-slate-200 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                            <Key className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <button
                              type="button"
                              onClick={() => setShowSofolXDeviceKey(!showSofolXDeviceKey)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                              title={showSofolXDeviceKey ? 'Hide key' : 'Show key'}
                            >
                              {showSofolXDeviceKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Forwarding Key for automated transaction matching</p>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                        আপনার <strong>{paymentSettings.sofolxDeviceName || 'nexg n6'}</strong> ডিভাইসের SofolX অ্যাপ থেকে বিকাশ, নগদ বা রকেট এসএমএস স্বয়ংক্রিয়ভাবে পেমেন্ট ভেরিফাই করার জন্য সফলভাবে কানেক্ট করা রয়েছে।
                      </div>
                    </div>

                    {/* Base URL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-800">
                          API Base URL
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={paymentSettings.sofolxBaseUrl}
                            onChange={e => setPaymentSettings({ ...paymentSettings, sofolxBaseUrl: e.target.value })}
                            placeholder="https://pay.sofolx.com"
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-[10px] text-slate-400">Official Production URL: https://pay.sofolx.com</p>
                      </div>

                      {/* Sandbox Simulator Option */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-800">
                          Sandbox / Test Mode
                        </label>
                        <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={paymentSettings.sofolxSandboxMode} 
                            onChange={e => setPaymentSettings({ ...paymentSettings, sofolxSandboxMode: e.target.checked })} 
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" 
                          />
                          <div>
                            <p className="text-xs font-semibold text-slate-900">Enable Sandbox Simulator</p>
                            <p className="text-[10px] text-slate-500">Allows simulating checkouts if live merchant key is pending</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Official API Endpoints Reference Card */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <div className="flex items-center justify-between font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Official SofolX Integration Endpoints
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Documentation v1.0</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-emerald-700 font-bold block">Create Payment:</span>
                          POST {paymentSettings.sofolxBaseUrl || 'https://pay.sofolx.com'}/api
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-emerald-700 font-bold block">Verify Payment:</span>
                          POST {paymentSettings.sofolxBaseUrl || 'https://pay.sofolx.com'}/api/verify
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-emerald-700 font-bold block">Callback URL:</span>
                          {typeof window !== 'undefined' ? `${window.location.origin}/payment/sofolx/callback` : '/payment/sofolx/callback'}
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-emerald-700 font-bold block">Webhook URL:</span>
                          {typeof window !== 'undefined' ? `${window.location.origin}/api/payment/sofolx/webhook` : '/api/payment/sofolx/webhook'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cash on Delivery (COD) */}
                  <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-xs">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">Cash on Delivery (COD)</p>
                        <p className="text-xs text-slate-500">Allow customers to pay cash when products are delivered</p>
                      </div>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={paymentSettings.codEnabled} 
                          onChange={e => setPaymentSettings({ ...paymentSettings, codEnabled: e.target.checked })} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-main"></div>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button 
                      onClick={() => handleSave('payment', paymentSettings, originalValues.payment)} 
                      disabled={saving} 
                      className="btn-primary flex items-center gap-2 px-6 py-2.5 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-semibold shadow-xs"
                    >
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Payment Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Order Settings */}
            {activeTab === 'order' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Order Settings</h2>
                </div>
                <div className="p-6 space-y-4">
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={orderSettings.orderingEnabled} onChange={e => setOrderSettings({...orderSettings, orderingEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Enable Ordering</p></div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={orderSettings.autoCancelEnabled} onChange={e => setOrderSettings({...orderSettings, autoCancelEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Enable Auto Cancel Unpaid Orders</p></div>
                  </label>
                  {orderSettings.autoCancelEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Auto Cancel After (Hours)</label>
                      <input type="number" value={orderSettings.autoCancelHours} onChange={e => setOrderSettings({...orderSettings, autoCancelHours: Number(e.target.value)})} className="w-full md:w-1/3 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                    </div>
                  )}
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={orderSettings.returnEnabled} onChange={e => setOrderSettings({...orderSettings, returnEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Enable Return Requests</p></div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={orderSettings.refundEnabled} onChange={e => setOrderSettings({...orderSettings, refundEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Enable Refund Requests</p></div>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Inside Dhaka Delivery Charge (৳)</label>
                      <input type="number" value={orderSettings.baseDeliveryCharge} onChange={e => setOrderSettings({...orderSettings, baseDeliveryCharge: Number(e.target.value)})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Outside Dhaka Delivery Charge (৳)</label>
                      <input type="number" value={orderSettings.outsideDeliveryCharge} onChange={e => setOrderSettings({...orderSettings, outsideDeliveryCharge: Number(e.target.value)})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button onClick={() => handleSave('order', orderSettings, originalValues.order)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Vendor Settings */}
            {activeTab === 'vendor' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Store className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Vendor Settings</h2>
                </div>
                <div className="p-6 space-y-4">
                   <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={vendorSettings.registrationEnabled} onChange={e => setVendorSettings({...vendorSettings, registrationEnabled: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Vendor Registration</p></div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={vendorSettings.autoApproveVendor} onChange={e => setVendorSettings({...vendorSettings, autoApproveVendor: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Auto Approve New Vendors</p></div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={vendorSettings.autoApproveProduct} onChange={e => setVendorSettings({...vendorSettings, autoApproveProduct: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Auto Approve Vendor Products</p></div>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Vendor Settlement (Days)</label>
                    <input type="number" value={vendorSettings.settlementDays} onChange={e => setVendorSettings({...vendorSettings, settlementDays: Number(e.target.value)})} className="w-full md:w-1/3 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                  </div>

                  {/* Verified Badge Pricing & Duration Settings */}
                  <div className="mt-6 p-5 border border-blue-200 bg-blue-50/50 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-100">
                      <div>
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                          ভেরিফাইড ব্যাজ সেটিংস (Verified Seller Badge)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ভেন্ডরের ভেরিফাইড ব্যাজের ফি ও কার্যকর মেয়াদ (মাস) নির্ধারণ করুন
                        </p>
                      </div>
                      <Link
                        to="/admin/verified-sellers"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                      >
                        ভেরিফাইড সেলার ম্যানেজার
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          ভেরিফাইড ব্যাজের মূল্য (টাকা)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">৳</span>
                          <input
                            type="number"
                            min="0"
                            value={vendorSettings.verifiedSellerPrice ?? 100}
                            onChange={e => setVendorSettings({ ...vendorSettings, verifiedSellerPrice: Number(e.target.value) })}
                            className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          ভেরিফাইড ব্যাজের মেয়াদ (মাস)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={vendorSettings.verifiedPlanMonths ?? 2}
                            onChange={e => setVendorSettings({ ...vendorSettings, verifiedPlanMonths: Number(e.target.value) })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="2"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">মাস</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/80 border border-blue-100 p-3 rounded-xl text-xs text-blue-900 leading-relaxed">
                      💡 <strong>স্বয়ংক্রিয় গণনা নিয়ম:</strong> ভেন্ডর যেই তারিখে ব্যাজ ক্রয়/নবায়ন করবে, ঐ নির্দিষ্ট দিন থেকে দিন গণনা শুরু হবে। মেয়াদ ({vendorSettings.verifiedPlanMonths ?? 2} মাস) পূর্ণ হলে ভেরিফাইড চিহ্ন স্বয়ংক্রিয়ভাবে অকার্যকর হয়ে যাবে এবং ভেন্ডর আবার ক্রয় করলে নতুন ক্রয় তারিখ থেকে পুনরায় মেয়াদ শুরু হবে।
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button onClick={() => handleSave('vendor', vendorSettings, originalValues.vendor)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Google Drive Settings */}
            {activeTab === 'googleDrive' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-slate-700" />
                    <h2 className="text-lg font-bold text-slate-900">Google Drive Shared Storage Pool</h2>
                  </div>
                  <Link
                    to="/admin/storage"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-main text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                  >
                    <span>Open Storage Pool Manager</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="p-6 space-y-5">
                  <div className="bg-emerald-50 p-4 rounded-xl flex items-start gap-3 border border-emerald-100">
                    <Database className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Multi-Account Google Drive Storage Pool is Enabled</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Multiple Google Drive accounts can be connected and pooled together for vendor product images. The system provides automated load-balancing, quota monitoring, and instant failover without exposing OAuth credentials.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                      <p className="text-xs font-medium text-slate-500">Shared Storage Pool Status</p>
                      <p className="text-base font-bold text-slate-900 mt-1">Multi-Account Failover Ready</p>
                      <p className="text-xs text-slate-500 mt-0.5">Automatic failover to next drive if full</p>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                      <p className="text-xs font-medium text-slate-500">Abstraction Layer</p>
                      <p className="text-base font-bold text-slate-900 mt-1">Extensible Storage Provider</p>
                      <p className="text-xs text-slate-500 mt-0.5">Seamless migration to S3/Cloud Storage ready</p>
                    </div>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Manage Connected Drives & Quota</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Connect Google Drive accounts via secure OAuth, monitor storage quotas in real-time, and manage files in the Storage Pool explorer.
                      </p>
                    </div>
                    <Link
                      to="/admin/storage"
                      className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
                    >
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      <span>Manage Storage Pool</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Security Settings</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Admin Session Timeout (Hours)</label>
                    <input type="number" value={securitySettings.sessionTimeoutHours} onChange={e => setSecuritySettings({...securitySettings, sessionTimeoutHours: Number(e.target.value)})} className="w-full md:w-1/3 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main" />
                  </div>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={securitySettings.requireTwoFactor} onChange={e => setSecuritySettings({...securitySettings, requireTwoFactor: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Require 2FA for Admins (Configuration Structure)</p></div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={securitySettings.activityLogging} onChange={e => setSecuritySettings({...securitySettings, activityLogging: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                    <div><p className="font-semibold text-slate-900">Enable Activity Logging for Administrative Changes</p></div>
                  </label>
                  <div className="flex justify-end pt-4">
                    <button onClick={() => handleSave('security', securitySettings, originalValues.security)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'notification' && (
              <div>
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Notification Settings</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={notificationSettings.newOrder} onChange={e => setNotificationSettings({...notificationSettings, newOrder: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                      <div><p className="font-semibold text-slate-900">New Order Alerts</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={notificationSettings.newWithdrawal} onChange={e => setNotificationSettings({...notificationSettings, newWithdrawal: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                      <div><p className="font-semibold text-slate-900">New Withdrawal Requests</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={notificationSettings.newUser} onChange={e => setNotificationSettings({...notificationSettings, newUser: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                      <div><p className="font-semibold text-slate-900">New User Registrations</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={notificationSettings.commissionGenerated} onChange={e => setNotificationSettings({...notificationSettings, commissionGenerated: e.target.checked})} className="w-5 h-5 rounded text-primary-main focus:ring-primary-main" />
                      <div><p className="font-semibold text-slate-900">Commission Generated Alerts</p></div>
                    </label>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button onClick={() => handleSave('notification', notificationSettings, originalValues.notification)} disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors">
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> Save Settings</>}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
