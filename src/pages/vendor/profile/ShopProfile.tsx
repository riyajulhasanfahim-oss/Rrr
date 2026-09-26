import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../../../context/AuthContext';
import { useVendorStore } from '../../../context/VendorStoreContext';
import { RTDB_BASE_URL } from '../../../lib/firebase';
import { rtdbGet, rtdbSet, rtdbUpdate } from '../../../lib/rtdb';
import { saveStoreThemeToCache, saveStoreToCache, getStoreFromCache } from '../../../services/storeCache';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Store, Palette, Image as ImageIcon, MapPin, Clock, Phone, Globe, 
  Facebook, Instagram, Youtube, Twitter, Save, Layout, CheckCircle2,
  Mail, MessageCircle, UploadCloud, Loader2, Copy, Check, Globe2, Link
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BANGLADESH_DISTRICTS } from '../../../data/bangladeshDistricts';
import { getDivisionByDistrict, extractVendorLocation } from '../../../utils/deliveryCalculator';
import {
  generateUniqueVendorSlug,
  getVendorSubdomain,
  getVendorStoreUrl,
  getVendorOpenUrl,
  slugifyVendorName,
  PRIMARY_DOMAIN
} from '../../../utils/subdomain';

// Helper to remove any undefined fields before sending to Realtime Database
function cleanObject(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject).filter(v => v !== undefined);
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = cleanObject(value);
    }
  }
  return result;
}

export default function ShopProfile() {
  const { user } = useAuth();
  const { vendorInfo, updateVendorInfo } = useVendorStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(() => !vendorInfo);
  const [saving, setSaving] = useState(false);

  // Profile State - initialized immediately from vendorInfo to prevent blank fields during navigation
  const [profile, setProfile] = useState<any>(() => ({
    shopName: vendorInfo?.shopName || vendorInfo?.storeName || '',
    description: vendorInfo?.description || '',
    category: vendorInfo?.category || 'Retail',
    contactNumber: vendorInfo?.contactNumber || vendorInfo?.mobileNumber || vendorInfo?.phone || '',
    whatsappNumber: vendorInfo?.whatsappNumber || vendorInfo?.whatsapp || '',
    email: vendorInfo?.email || user?.email || '',
    website: vendorInfo?.website || '',
    facebook: vendorInfo?.facebook || '',
    youtube: vendorInfo?.youtube || '',
    instagram: vendorInfo?.instagram || '',
    tiktok: vendorInfo?.tiktok || '',
    address: (() => {
      const vLoc = extractVendorLocation(vendorInfo, vendorInfo);
      const rawAddr = vendorInfo?.address as any;
      const isObj = typeof rawAddr === 'object' && rawAddr !== null;
      const dist = (isObj ? (rawAddr.district || rawAddr.state) : '') || vendorInfo?.district || vendorInfo?.vendorDistrict || vLoc.district || '';
      const up = (isObj ? (rawAddr.upazila || rawAddr.city) : '') || vendorInfo?.upazila || vendorInfo?.vendorUpazila || vLoc.upazila || '';
      const div = (isObj ? rawAddr.division : '') || vendorInfo?.division || vendorInfo?.vendorDivision || vLoc.division || (dist ? getDivisionByDistrict(dist) : '');
      const street = (isObj ? (rawAddr.street || rawAddr.area) : (typeof rawAddr === 'string' ? rawAddr : '')) || vLoc.area || '';
      const zip = (isObj ? rawAddr.zip : '') || '';

      return {
        street,
        city: up,
        state: dist,
        district: dist,
        upazila: up,
        division: div,
        zip,
        country: 'Bangladesh'
      };
    })(),
    openingHours: vendorInfo?.openingHours || 'Mon-Fri: 9 AM - 6 PM',
    mapLocation: vendorInfo?.mapLocation || '',
    status: vendorInfo?.status || 'Active',
    verificationBadge: !!(vendorInfo?.verificationBadge || vendorInfo?.verificationStatus === 'verified'),
    seo: vendorInfo?.seo || {
      title: '',
      description: '',
      keywords: '',
      urlSlug: ''
    },
    shopSlug: vendorInfo?.shopSlug || '',
    freeShopDomain: vendorInfo?.freeShopDomain || '',
    customDomain: vendorInfo?.customDomain || '',
    customDomainStatus: vendorInfo?.customDomainStatus || 'Pending',
    verificationStatus: vendorInfo?.verificationStatus || 'Pending'
  }));

  const [verifyingDomain, setVerifyingDomain] = useState(false);

  const [media, setMedia] = useState(() => ({
    logo: vendorInfo?.logo || vendorInfo?.shopLogo || vendorInfo?.profileImage || '',
    logoId: '',
    banner: vendorInfo?.banner || vendorInfo?.shopBanner || ''
  }));

  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const [copiedLinks, setCopiedLinks] = useState<Record<string, boolean>>({});

  const handleImageUpload = async (field: 'logo', e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadingImages[field]) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file format. Please upload PNG, JPG, GIF, WEBP, AVIF, or BMP.');
      e.target.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Image size must be less than 25MB');
      e.target.value = '';
      return;
    }

    setUploadingImages(prev => ({ ...prev, [field]: true }));
    const toastId = toast.loading('Uploading shop logo...');

    try {
      let uploadFile: File = file;
      if (file.size > 700 * 1024) {
        try {
          uploadFile = await imageCompression(file, {
            maxSizeMB: 0.7,
            maxWidthOrHeight: 1200,
            useWebWorker: true
          });
        } catch (_) {
          uploadFile = file;
        }
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64Data }),
          });

          const data = await response.json();
          if (data && data.success && data.url) {
            setMedia(prev => ({ ...prev, logo: data.url }));
            setProfile((prev: any) => ({ ...prev, logo: data.url }));
            toast.success('Logo uploaded successfully!', { id: toastId });
          } else {
            throw new Error(data?.error || 'Failed to upload image');
          }
        } catch (error: any) {
          console.error('Upload error:', error);
          toast.error(error.message || 'Error uploading image', { id: toastId });
        } finally {
          setUploadingImages(prev => ({ ...prev, [field]: false }));
        }
      };

      reader.onerror = () => {
        toast.error('Failed to read file', { id: toastId });
        setUploadingImages(prev => ({ ...prev, [field]: false }));
      };

      reader.readAsDataURL(uploadFile);
    } catch (error: any) {
      console.error('Upload processing error:', error);
      toast.error('Error processing image', { id: toastId });
      setUploadingImages(prev => ({ ...prev, [field]: false }));
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLinks(prev => ({ ...prev, [key]: true }));
    toast.success('Copied to clipboard');
    setTimeout(() => {
      setCopiedLinks(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  // Theme State
  const [theme, setTheme] = useState({
    primaryColor: '#6366f1',
    secondaryColor: '#4f46e5',
    fontStyle: 'Inter',
    announcement: 'Welcome to our store!',
    featuredProductIds: []
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Profile, Vendor, Store, and Theme directly from Firebase Realtime Database
      const [profileData, vendorData, storeData, themeData] = await Promise.all([
        rtdbGet<any>(`vendor_profiles/${user.uid}`),
        rtdbGet<any>(`vendors/${user.uid}`),
        rtdbGet<any>(`stores/${user.uid}`),
        rtdbGet<any>(`vendor_themes/${user.uid}`)
      ]);

      let loadedProfileData = profileData;
      let loadedVendorData = vendorData;
      let loadedStoreData = storeData;

      // Check Realtime Database fallback using direct URL if needed
      if (!loadedProfileData && !loadedVendorData) {
        try {
          const rtdbRes = await fetch(`${RTDB_BASE_URL}/vendor_profiles/${user.uid}.json`).catch(() => null);
          if (rtdbRes && rtdbRes.ok) {
            loadedProfileData = await rtdbRes.json();
          }
          const rtdbVendorRes = await fetch(`${RTDB_BASE_URL}/vendors/${user.uid}.json`).catch(() => null);
          if (rtdbVendorRes && rtdbVendorRes.ok) {
            loadedVendorData = await rtdbVendorRes.json();
          }
        } catch (_) {}
      }

      // Check localStorage cache fallback
      if (!loadedProfileData) {
        try {
          const localProf = localStorage.getItem('rj_vendor_profile_' + user.uid);
          if (localProf) loadedProfileData = JSON.parse(localProf);
        } catch (_) {}
      }
      if (!loadedVendorData) {
        try {
          const localVen = localStorage.getItem('rj_active_vendor_' + user.uid);
          if (localVen) loadedVendorData = JSON.parse(localVen);
        } catch (_) {}
      }

      // If no data exists in RTDB yet, populate local form defaults without saving to database
      if (!loadedProfileData && !loadedVendorData && !loadedStoreData) {
        const initialShopName = user.displayName ? `${user.displayName}'s Store` : 'My Store';
        const initialSlug = initialShopName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const initialRecord = {
          shopName: initialShopName,
          storeName: initialShopName,
          description: `Welcome to ${initialShopName}`,
          category: 'Retail',
          contactNumber: user.phoneNumber || '',
          whatsappNumber: user.phoneNumber || '',
          email: user.email || '',
          website: '',
          facebook: '',
          youtube: '',
          instagram: '',
          tiktok: '',
          address: {
            street: '',
            city: '',
            state: '',
            zip: '',
            country: 'Bangladesh'
          },
          openingHours: 'Mon-Fri: 9 AM - 6 PM',
          status: 'Pending',
          verificationBadge: false,
          verificationStatus: 'Pending',
          shopSlug: initialSlug,
          freeShopDomain: `${initialSlug}.rjworldbd.com`,
          customDomain: '',
          customDomainStatus: 'Pending',
          logo: '',
          banner: '',
          vendorId: user.uid,
          userId: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        // Note: Do NOT automatically save to RTDB here.
        // The store is ONLY saved to the database when the user explicitly clicks Save.
        loadedProfileData = initialRecord;
      }

      const rawVendorAddr = loadedVendorData?.address || loadedProfileData?.address || loadedStoreData?.address || profile.address;
      const vLoc = extractVendorLocation(loadedVendorData || loadedProfileData || loadedStoreData, loadedVendorData);
      const isObj = typeof rawVendorAddr === 'object' && rawVendorAddr !== null;
      const resolvedDist = (isObj ? (rawVendorAddr.district || rawVendorAddr.state) : '') || loadedVendorData?.district || loadedProfileData?.district || vLoc.district || '';
      const resolvedUp = (isObj ? (rawVendorAddr.upazila || rawVendorAddr.city) : '') || loadedVendorData?.upazila || loadedProfileData?.upazila || vLoc.upazila || '';
      const resolvedDiv = (isObj ? rawVendorAddr.division : '') || loadedVendorData?.division || loadedProfileData?.division || vLoc.division || (resolvedDist ? getDivisionByDistrict(resolvedDist) : '');
      const resolvedStreet = (isObj ? (rawVendorAddr.street || rawVendorAddr.area) : (typeof rawVendorAddr === 'string' ? rawVendorAddr : '')) || vLoc.area || '';
      const resolvedZip = (isObj ? rawVendorAddr.zip : '') || '';

      const normalizedAddress = {
        street: resolvedStreet,
        city: resolvedUp,
        state: resolvedDist,
        district: resolvedDist,
        upazila: resolvedUp,
        division: resolvedDiv,
        zip: resolvedZip,
        country: 'Bangladesh'
      };

      const mergedProfile = {
        ...profile,
        ...(loadedStoreData || {}),
        ...(loadedVendorData ? {
          shopName: loadedVendorData.shopName || loadedVendorData.storeName || '',
          email: loadedVendorData.email || user.email || '',
          contactNumber: loadedVendorData.contactNumber || loadedVendorData.mobileNumber || loadedVendorData.phone || '',
          whatsappNumber: loadedVendorData.whatsappNumber || loadedVendorData.contactNumber || ''
        } : {}),
        ...(loadedProfileData || {}),
        address: normalizedAddress
      };

      const resolvedLogo = loadedProfileData?.logo || loadedVendorData?.logo || loadedStoreData?.logo || '';
      const resolvedBanner = loadedProfileData?.banner || loadedVendorData?.banner || loadedStoreData?.banner || '';

      setProfile((prev: any) => ({ ...prev, ...mergedProfile }));
      await updateVendorInfo({
        ...mergedProfile,
        logo: resolvedLogo || mergedProfile.logo,
        banner: resolvedBanner || mergedProfile.banner
      });

      setMedia({
        logo: resolvedLogo,
        logoId: '',
        banner: resolvedBanner
      });

      // 2. Fetch Theme from RTDB
      const resolvedTheme = themeData || loadedProfileData?.theme;
      if (resolvedTheme) {
        setTheme(t => ({ ...t, ...resolvedTheme }));
      }

    } catch (error) {
      console.error("Error fetching vendor data from RTDB:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = async (name: string) => {
    return await generateUniqueVendorSlug(name, user?.uid);
  };

  const handleGenerateFreeDomain = async () => {
    const rawName = (profile.shopName || profile.storeName || '').trim();
    if (!rawName) {
      toast.error('Please enter a Shop Name in Basic Profile first');
      return;
    }
    setVerifyingDomain(true);
    try {
      const slug = await generateUniqueVendorSlug(rawName, user?.uid);
      const freeDomain = `${slug}.${PRIMARY_DOMAIN}`;
      const newProfile = { 
        ...profile, 
        shopSlug: slug, 
        storeSlug: slug, 
        freeShopDomain: freeDomain, 
        updatedAt: Date.now() 
      };
      setProfile(newProfile);
      if (user) {
        await Promise.all([
          rtdbUpdate(`vendor_profiles/${user.uid}`, { shopSlug: slug, storeSlug: slug, freeShopDomain: freeDomain, updatedAt: Date.now() }),
          rtdbUpdate(`vendors/${user.uid}`, { shopSlug: slug, storeSlug: slug, freeShopDomain: freeDomain, updatedAt: Date.now() }),
          rtdbUpdate(`stores/${user.uid}`, { shopSlug: slug, storeSlug: slug, freeShopDomain: freeDomain, updatedAt: Date.now() })
        ]);
        try {
          localStorage.setItem('rj_vendor_profile_' + user.uid, JSON.stringify(newProfile));
          window.dispatchEvent(new Event('vendor_profile_updated'));
        } catch (_) {}
      }
      toast.success('Free Shop Domain generated & saved successfully!');
    } catch (e) {
      console.error('Error generating domain:', e);
      toast.error('Failed to generate domain');
    } finally {
      setVerifyingDomain(false);
    }
  };

  const handleVerifyCustomDomain = async () => {
    if (!profile.customDomain) {
      toast.error('Please enter a custom domain');
      return;
    }
    
    // Validate domain format
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9].[a-zA-Z]{2,}$/;
    let domainToCheck = profile.customDomain.replace('https://', '').replace('http://', '').split('/')[0];
    
    if (!domainPattern.test(domainToCheck)) {
      toast.error('Invalid domain format. Example: www.myshop.com');
      return;
    }

    setVerifyingDomain(true);
    try {
      // Use Google DNS API to verify CNAME/A records pointing to our app
      const response = await fetch(`https://dns.google/resolve?name=${domainToCheck}&type=CNAME`);
      const data = await response.json();
      
      let verified = false;
      
      if (data.Answer) {
        for (const record of data.Answer) {
          if (record.data && (record.data.includes('rjworld.com') || record.data.includes('run.app') || record.data.includes('rjworldbd.com'))) {
            verified = true;
            break;
          }
        }
      }
      
      if (!verified) {
         // Fallback to checking A record if they used an A record instead
         const aResponse = await fetch(`https://dns.google/resolve?name=${domainToCheck}&type=A`);
         const aData = await aResponse.json();
         if (aData.Answer && aData.Answer.length > 0) {
            verified = true; 
         }
      }

      if (verified) {
        const newProfile = { ...profile, customDomainStatus: 'Verified', verificationStatus: 'Verified', customDomain: domainToCheck, updatedAt: Date.now() };
        setProfile(newProfile);
        if (user) {
          await Promise.all([
            rtdbUpdate(`vendor_profiles/${user.uid}`, { customDomain: domainToCheck, customDomainStatus: 'Verified', verificationStatus: 'Verified', updatedAt: Date.now() }),
            rtdbUpdate(`vendors/${user.uid}`, { customDomain: domainToCheck, customDomainStatus: 'Verified', verificationStatus: 'Verified', updatedAt: Date.now() }),
            rtdbUpdate(`stores/${user.uid}`, { customDomain: domainToCheck, customDomainStatus: 'Verified', verificationStatus: 'Verified', updatedAt: Date.now() })
          ]);
          try {
            localStorage.setItem('rj_vendor_profile_' + user.uid, JSON.stringify(newProfile));
            window.dispatchEvent(new Event('vendor_profile_updated'));
          } catch (_) {}
        }
        toast.success('Domain verified & saved successfully!');
      } else {
        setProfile((prev: any) => ({ ...prev, customDomainStatus: 'Pending', verificationStatus: 'Pending', customDomain: domainToCheck }));
        toast.error('Verification failed. Please check DNS settings.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Verification check failed');
    } finally {
      setVerifyingDomain(false);
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!user) {
      toast.error('Please log in to save your shop profile');
      return;
    }
    setSaving(true);
    const toastId = toast.loading('Saving shop profile...');
    try {
      const now = Date.now();
      const shopTitle = (profile.shopName || profile.storeName || '').trim();

      // Ensure a valid unique subdomain is automatically generated if missing or outdated
      let finalSlug = (profile.shopSlug || profile.storeSlug || '').trim();
      let finalFreeDomain = (profile.freeShopDomain || '').trim();
      if (
        !finalFreeDomain || 
        !finalSlug || 
        finalFreeDomain.endsWith('.rjworld.com') || 
        !finalFreeDomain.endsWith(`.${PRIMARY_DOMAIN}`)
      ) {
        if (shopTitle) {
          finalSlug = await generateUniqueVendorSlug(shopTitle, user.uid);
          finalFreeDomain = `${finalSlug}.${PRIMARY_DOMAIN}`;
        }
      }

      const selectedDistrict = (profile.address?.district || profile.address?.state || '').trim();
      const selectedUpazila = (profile.address?.upazila || profile.address?.city || '').trim();
      const selectedDivision = (profile.address?.division || (selectedDistrict ? getDivisionByDistrict(selectedDistrict) : '')).trim();
      const selectedStreet = (profile.address?.street || '').trim();
      const selectedZip = (profile.address?.zip || '').trim();

      const structuredAddress = {
        ...profile.address,
        street: selectedStreet,
        area: selectedStreet,
        city: selectedUpazila,
        state: selectedDistrict,
        district: selectedDistrict,
        upazila: selectedUpazila,
        division: selectedDivision,
        zip: selectedZip,
        country: 'Bangladesh'
      };

      const structuredVendorLocation = {
        district: selectedDistrict,
        upazila: selectedUpazila,
        division: selectedDivision,
        area: selectedStreet
      };

      const profilePayload = cleanObject({
        ...profile,
        shopName: shopTitle,
        storeName: shopTitle,
        address: structuredAddress,
        district: selectedDistrict,
        upazila: selectedUpazila,
        thana: selectedUpazila,
        division: selectedDivision,
        vendorDistrict: selectedDistrict,
        vendorUpazila: selectedUpazila,
        vendorDivision: selectedDivision,
        vendorLocation: structuredVendorLocation,
        logo: media.logo || profile.logo || '',
        banner: media.banner || profile.banner || '',
        verifiedAt: vendorInfo?.verifiedAt || profile.verifiedAt || null,
        planExpiresAt: vendorInfo?.planExpiresAt || profile.planExpiresAt || 0,
        verifiedDurationMonths: vendorInfo?.verifiedDurationMonths || profile.verifiedDurationMonths || null,
        verifiedPlanPrice: vendorInfo?.verifiedPlanPrice || profile.verifiedPlanPrice || null,
        verifiedPaymentMethod: vendorInfo?.verifiedPaymentMethod || profile.verifiedPaymentMethod || null,
        verifiedTrxId: vendorInfo?.verifiedTrxId || profile.verifiedTrxId || null,
        isVerified: vendorInfo?.isVerified ?? profile.isVerified ?? false,
        verified: vendorInfo?.verified ?? profile.verified ?? false,
        blueBadge: vendorInfo?.blueBadge ?? profile.blueBadge ?? false,
        isVerifiedSeller: vendorInfo?.isVerifiedSeller ?? profile.isVerifiedSeller ?? false,
        verifiedSellerPlanActive: vendorInfo?.verifiedSellerPlanActive ?? false,
        vendorId: user.uid,
        userId: user.uid,
        updatedAt: now
      });

      const vendorPayload = cleanObject({
        shopName: shopTitle,
        storeName: shopTitle,
        ownerName: profile.ownerName || shopTitle || user.displayName || '',
        logo: media.logo || profile.logo || '',
        banner: media.banner || profile.banner || '',
        email: profile.email || user.email || '',
        contactNumber: profile.contactNumber || profile.mobileNumber || profile.phone || '',
        mobileNumber: profile.contactNumber || profile.mobileNumber || profile.phone || '',
        phone: profile.contactNumber || profile.mobileNumber || profile.phone || '',
        whatsappNumber: profile.whatsappNumber || profile.contactNumber || '',
        website: profile.website || '',
        facebook: profile.facebook || '',
        instagram: profile.instagram || '',
        youtube: profile.youtube || '',
        tiktok: profile.tiktok || '',
        address: structuredAddress,
        district: selectedDistrict,
        upazila: selectedUpazila,
        thana: selectedUpazila,
        division: selectedDivision,
        vendorDistrict: selectedDistrict,
        vendorUpazila: selectedUpazila,
        vendorDivision: selectedDivision,
        vendorLocation: structuredVendorLocation,
        openingHours: profile.openingHours || 'Mon-Fri: 9 AM - 6 PM',
        category: profile.category || 'Retail',
        status: profile.status || 'Active',
        shopSlug: finalSlug || profile.shopSlug || '',
        storeSlug: finalSlug || profile.storeSlug || '',
        freeShopDomain: finalFreeDomain || profile.freeShopDomain || '',
        customDomain: profile.customDomain || '',
        customDomainStatus: profile.customDomainStatus || 'Pending',
        verificationStatus: profile.verificationStatus || vendorInfo?.verificationStatus || 'Pending',
        verificationBadge: profile.verificationBadge || vendorInfo?.verificationBadge || false,
        verifiedAt: vendorInfo?.verifiedAt || null,
        planExpiresAt: vendorInfo?.planExpiresAt || 0,
        verifiedDurationMonths: vendorInfo?.verifiedDurationMonths || null,
        verifiedPlanPrice: vendorInfo?.verifiedPlanPrice || null,
        verifiedPaymentMethod: vendorInfo?.verifiedPaymentMethod || null,
        verifiedTrxId: vendorInfo?.verifiedTrxId || null,
        isVerified: vendorInfo?.isVerified ?? false,
        verified: vendorInfo?.verified ?? false,
        blueBadge: vendorInfo?.blueBadge ?? false,
        isVerifiedSeller: vendorInfo?.isVerifiedSeller ?? false,
        verifiedSellerPlanActive: vendorInfo?.verifiedSellerPlanActive ?? false,
        userId: user.uid,
        vendorId: user.uid,
        updatedAt: now
      });

      const storePayload = cleanObject({
        ...profilePayload,
        id: user.uid,
        storeId: user.uid
      });

      // 1. Guaranteed Realtime Database write (Zero Firestore!)
      await Promise.all([
        rtdbSet(`vendor_profiles/${user.uid}`, profilePayload),
        rtdbSet(`vendors/${user.uid}`, vendorPayload),
        rtdbSet(`stores/${user.uid}`, storePayload)
      ]);

      // 2. Server-Side Realtime Database & Disk Sync
      try {
        await fetch('/api/vendor/save-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorId: user.uid,
            profileData: profilePayload,
            vendorData: vendorPayload
          })
        });
      } catch (srvErr) {
        console.warn('Server sync notice:', srvErr);
      }

      // 3. Update persistent vendor store context & caches for instant UI responsiveness across all routes
      await updateVendorInfo({
        ...profilePayload,
        ...vendorPayload
      });

      // 4. Re-read from RTDB to confirm data is persisted and show updated data in form
      await fetchData();

      toast.success('Shop profile updated successfully', { id: toastId });
    } catch (error: any) {
      console.error("Error saving profile to RTDB:", error);
      toast.error(error?.message || 'Failed to update shop profile', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const now = Date.now();
      const themePayload = cleanObject({
        ...theme,
        vendorId: user.uid,
        updatedAt: now
      });

      await Promise.all([
        rtdbSet(`vendor_themes/${user.uid}`, themePayload),
        rtdbUpdate(`vendor_profiles/${user.uid}`, { theme: themePayload, updatedAt: now }),
        rtdbUpdate(`vendors/${user.uid}`, { theme: themePayload, updatedAt: now }),
        rtdbUpdate(`stores/${user.uid}`, { theme: themePayload, primaryColor: themePayload.primaryColor, updatedAt: now })
      ]);

      // Immediately cache for zero-delay presentation on navigation
      saveStoreThemeToCache(user.uid, themePayload);
      const existing = getStoreFromCache(user.uid);
      if (existing) {
        saveStoreToCache(user.uid, {
          ...existing,
          theme: themePayload,
          primaryColor: themePayload.primaryColor
        });
      }

      window.dispatchEvent(new Event('vendor_profile_updated'));
      toast.success('Store theme updated successfully');
    } catch (error) {
      console.error("Error saving theme to RTDB:", error);
      toast.error('Failed to update store theme');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'address.district') {
      const div = getDivisionByDistrict(value);
      setProfile(prev => ({
        ...prev,
        address: {
          ...prev.address,
          district: value,
          state: value,
          upazila: '',
          city: '',
          division: div
        }
      }));
      return;
    }
    if (name === 'address.upazila') {
      setProfile(prev => ({
        ...prev,
        address: {
          ...prev.address,
          upazila: value,
          city: value
        }
      }));
      return;
    }
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfile(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as any),
          [child]: value
        }
      }));
    } else {
      setProfile(prev => ({ ...prev, [name]: value }));
    }
  };

  if (loading) {
    return (
      <VendorLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200  rounded w-1/4"></div>
          <div className="h-10 bg-gray-200  rounded-lg w-full max-w-md"></div>
          <div className="h-96 bg-gray-200  rounded-2xl"></div>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-primary-main" />
            <span>Shop Profile</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Manage your storefront appearance and information.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {user && (
            <a 
              href={`/store/${user.uid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl text-xs hover:bg-gray-50 transition-colors flex items-center gap-1 shadow-sm"
            >
              <Globe className="w-3.5 h-3.5" /> <span className="hidden sm:inline">View</span> Store
            </a>
          )}
          {profile.verificationBadge && (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-lg text-[10px] sm:text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          )}
          <span className={`px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold ${
            profile.status === 'Active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {profile.status}
          </span>
        </div>
      </div>

      <div className="flex gap-1 mb-3 border-b border-gray-200 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'profile'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          Basic Profile
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'media'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Media & Logo
        </button>
        <button
          onClick={() => setActiveTab('customization')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'customization'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Customization
        </button>
        <button
          onClick={() => setActiveTab('domain')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'domain'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe2 className="w-3.5 h-3.5" />
          Domain
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-3 sm:p-5 space-y-4">
            {/* General Info */}
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2.5 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-primary-main" />
                General Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Shop Name *</label>
                  <input
                    type="text"
                    required
                    name="shopName"
                    value={profile.shopName}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Business Category</label>
                  <select
                    name="category"
                    value={profile.category}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 text-gray-900"
                  >
                    <option>Retail</option>
                    <option>Fashion</option>
                    <option>Electronics</option>
                    <option>Groceries</option>
                    <option>Beauty & Health</option>
                    <option>Services</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Shop Description</label>
                  <textarea
                    name="description"
                    value={profile.description}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 text-gray-900 resize-none"
                    placeholder="Tell customers about your shop..."
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-primary-main" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Contact Number</label>
                  <input
                    type="text"
                    name="contactNumber"
                    value={profile.contactNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">WhatsApp Number</label>
                  <input
                    type="text"
                    name="whatsappNumber"
                    value={profile.whatsappNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profile.email}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Website</label>
                  <input
                    type="url"
                    name="website"
                    value={profile.website}
                    onChange={handleChange}
                    placeholder="https://"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2.5 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-primary-main" />
                Social Media
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Facebook</label>
                  <div className="relative">
                    <Facebook className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="url"
                      name="facebook"
                      value={profile.facebook}
                      onChange={handleChange}
                      placeholder="https://facebook.com/..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Instagram</label>
                  <div className="relative">
                    <Instagram className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="url"
                      name="instagram"
                      value={profile.instagram}
                      onChange={handleChange}
                      placeholder="https://instagram.com/..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">YouTube</label>
                  <div className="relative">
                    <Youtube className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="url"
                      name="youtube"
                      value={profile.youtube}
                      onChange={handleChange}
                      placeholder="https://youtube.com/..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">TikTok</label>
                  <input
                    type="url"
                    name="tiktok"
                    value={profile.tiktok}
                    onChange={handleChange}
                    placeholder="https://tiktok.com/..."
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary-main" />
                  স্টোর / পিকআপ লোকেশন ও ঠিকানা (Pickup Location & Address)
                </h3>
                <span className="text-[10px] sm:text-xs text-primary-main font-medium bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                  পাথাও রেট উপযোগী
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                📍 সঠিক জেলা ও থানা নির্বাচন করুন যাতে কাস্টমারদের জন্য পাথাও ডেলিভারি চার্জ দূরত্ব অনুযায়ী নিখুঁতভাবে নির্ধারিত হয়।
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-700 mb-1">
                    জেলা (District) *
                  </label>
                  <select
                    name="address.district"
                    value={profile.address.district || profile.address.state || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:border-primary-main focus:outline-none text-gray-900"
                  >
                    <option value="">জেলা নির্বাচন করুন</option>
                    {BANGLADESH_DISTRICTS.map(d => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-700 mb-1">
                    থানা / উপজেলা (Upazila / Thana) *
                  </label>
                  <select
                    name="address.upazila"
                    disabled={!(profile.address.district || profile.address.state)}
                    value={profile.address.upazila || profile.address.city || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:border-primary-main focus:outline-none text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">
                      {(profile.address.district || profile.address.state) ? 'থানা/উপজেলা নির্বাচন করুন' : 'আগে জেলা নির্বাচন করুন'}
                    </option>
                    {(BANGLADESH_DISTRICTS.find(d => d.name === (profile.address.district || profile.address.state) || d.id === (profile.address.district || profile.address.state))?.upazilas || []).map(up => {
                      const upName = typeof up === 'string' ? up : up.name;
                      const upId = typeof up === 'string' ? up : up.id;
                      return (
                        <option key={upId} value={upName}>
                          {upName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-700 mb-1">
                    পোস্টাল কোড (Postal Code)
                  </label>
                  <input
                    type="text"
                    name="address.zip"
                    value={profile.address.zip}
                    onChange={handleChange}
                    placeholder="যেমন: ১২০৭"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-700 mb-1">
                    বিস্তারিত পিকআপ ঠিকানা (রাস্তা, বাজার, দোকান নং) *
                  </label>
                  <input
                    type="text"
                    name="address.street"
                    value={profile.address.street}
                    onChange={handleChange}
                    placeholder="যেমন: দোকান নং ১২, নিউ মার্কেট, মেইন রোড"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-700 mb-1">
                    খোলা থাকার সময় (Opening Hours)
                  </label>
                  <input
                    type="text"
                    name="openingHours"
                    value={profile.openingHours}
                    onChange={handleChange}
                    placeholder="e.g. Mon-Fri: 9 AM - 6 PM"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-main text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'media' && (
          <div className="p-3 sm:p-5 space-y-4">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-1">Shop Logo</h3>
              <p className="text-[11px] sm:text-xs text-gray-500 mb-2.5">Recommended size: 400x400px (1:1 ratio)</p>
              
              <div className="flex flex-row items-center gap-3">
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  {media.logo ? (
                    <img referrerPolicy="no-referrer" src={media.logo} alt="Shop Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="url"
                        value={media.logo || ''}
                        onChange={(e) => setMedia(prev => ({ ...prev, logo: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900 pr-7"
                        placeholder="Image URL or upload"
                      />
                      {media.logo && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(media.logo, 'logo')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-primary-main transition-colors"
                          title="Copy Link"
                        >
                          {copiedLinks['logo'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    <label className={`shrink-0 flex items-center justify-center px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors font-medium text-xs ${uploadingImages['logo'] ? 'opacity-70 pointer-events-none' : ''}`}>
                      {uploadingImages['logo'] ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <UploadCloud className="w-3.5 h-3.5 mr-1" />}
                      <span>{uploadingImages['logo'] ? '...' : 'Upload'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload('logo', e)}
                        disabled={uploadingImages['logo']}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-4 py-2 bg-primary-main text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Media'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'domain' && (
          <div className="p-3 sm:p-5 space-y-4">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-primary-main" />
                Free RJ WORLD BD Shop Domain
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500 mb-2">Get a free unique storefront domain</p>
              
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                  <div className="flex-grow">
                    <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Your Free Domain</label>
                    <div className="flex items-center bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm">
                      <Link className="w-3.5 h-3.5 text-gray-400 mr-1.5 shrink-0" />
                      <input
                        type="text"
                        readOnly
                        value={profile.freeShopDomain ? `https://${profile.freeShopDomain}/` : (profile.shopSlug ? `https://${profile.shopSlug}.${PRIMARY_DOMAIN}/` : 'Not generated yet')}
                        className="bg-transparent flex-grow outline-none text-gray-700 font-medium text-xs sm:text-sm truncate select-all"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateFreeDomain}
                    disabled={verifyingDomain}
                    className="px-3 py-1.5 bg-primary-main text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
                  >
                    {verifyingDomain ? 'Generating...' : (profile.freeShopDomain ? 'Regenerate' : 'Generate')}
                  </button>
                </div>
                {profile.freeShopDomain && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active: 
                      <a 
                        href={getVendorOpenUrl(profile.freeShopDomain, user?.uid)} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="underline truncate max-w-[200px]"
                      >
                        https://{profile.freeShopDomain}/
                      </a>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://${profile.freeShopDomain}/`);
                        toast.success('Shop link copied!');
                      }}
                      className="text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <a
                      href={getVendorOpenUrl(profile.freeShopDomain, user?.uid)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold bg-primary-main hover:bg-sky-600 text-white py-1 px-2.5 rounded-lg flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                    >
                      Open
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                <Globe2 className="w-4 h-4 text-primary-main" />
                Custom Domain
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500 mb-2">Connect your own custom domain</p>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                  <div className="flex-grow">
                    <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Domain URL</label>
                    <input
                      type="text"
                      value={profile.customDomain || ''}
                      onChange={(e) => setProfile((prev: any) => ({ ...prev, customDomain: e.target.value, customDomainStatus: 'Pending', verificationStatus: 'Pending' }))}
                      placeholder="www.myshop.com"
                      className="w-full px-2.5 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-primary-main text-gray-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyCustomDomain}
                    disabled={verifyingDomain || !profile.customDomain}
                    className="px-3 py-1.5 border border-primary-main text-primary-main font-bold text-xs sm:text-sm rounded-xl hover:bg-sky-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {verifyingDomain ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                
                <div className="mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <h3 className="text-xs font-bold text-slate-800 mb-1">DNS Configuration</h3>
                  <p className="text-[11px] text-slate-600 mb-2">Add a CNAME record to your DNS settings:</p>
                  
                  <div className="overflow-x-auto text-[11px]">
                    <table className="w-full text-left text-gray-600">
                      <thead className="bg-gray-100 rounded">
                        <tr>
                          <th className="px-2 py-1">Type</th>
                          <th className="px-2 py-1">Host</th>
                          <th className="px-2 py-1">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white border-b">
                          <td className="px-2 py-1 font-semibold">CNAME</td>
                          <td className="px-2 py-1">www (@)</td>
                          <td className="px-2 py-1 font-mono text-primary-main">shops.rjworld.com</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between p-2 rounded-xl border bg-white text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${profile.verificationStatus === 'Verified' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Status: {profile.verificationStatus || 'Pending'}</p>
                    </div>
                  </div>
                  {profile.verificationStatus === 'Verified' && (
                    <button 
                      type="button" 
                      onClick={async () => {
                        const newProfile = { ...profile, customDomain: '', customDomainStatus: 'Pending', verificationStatus: 'Pending', updatedAt: Date.now() };
                        setProfile(newProfile);
                        if (user) {
                          await Promise.all([
                            rtdbUpdate(`vendor_profiles/${user.uid}`, { customDomain: '', customDomainStatus: 'Pending', verificationStatus: 'Pending', updatedAt: Date.now() }),
                            rtdbUpdate(`vendors/${user.uid}`, { customDomain: '', customDomainStatus: 'Pending', verificationStatus: 'Pending', updatedAt: Date.now() }),
                            rtdbUpdate(`stores/${user.uid}`, { customDomain: '', customDomainStatus: 'Pending', verificationStatus: 'Pending', updatedAt: Date.now() })
                          ]);
                          try {
                            localStorage.setItem('rj_vendor_profile_' + user.uid, JSON.stringify(newProfile));
                            window.dispatchEvent(new Event('vendor_profile_updated'));
                          } catch (_) {}
                        }
                        toast.success('Custom domain removed');
                      }}
                      className="text-red-500 text-xs font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customization' && (
          <form onSubmit={handleSaveTheme} className="p-3 sm:p-5 space-y-4">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-primary-main" />
                Store Theme Colors
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.primaryColor}
                      onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={theme.primaryColor}
                      onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="flex-1 px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900 uppercase font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.secondaryColor}
                      onChange={(e) => setTheme(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={theme.secondaryColor}
                      onChange={(e) => setTheme(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="flex-1 px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900 uppercase font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                <Layout className="w-4 h-4 text-primary-main" />
                Typography & Announcement
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Font Style</label>
                  <select
                    value={theme.fontStyle}
                    onChange={(e) => setTheme(prev => ({ ...prev, fontStyle: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                  >
                    <option value="Inter">Inter (Modern Sans)</option>
                    <option value="Roboto">Roboto (Clean Sans)</option>
                    <option value="Playfair Display">Playfair Display (Serif)</option>
                    <option value="Poppins">Poppins (Friendly Sans)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-gray-700 mb-0.5">Store Announcement Bar</label>
                  <input
                    type="text"
                    value={theme.announcement}
                    onChange={(e) => setTheme(prev => ({ ...prev, announcement: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none text-gray-900"
                    placeholder="e.g. Free shipping on orders over $50!"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-main text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Theme'}
              </button>
            </div>
          </form>
        )}
      </div>
    </VendorLayout>
  );
}
