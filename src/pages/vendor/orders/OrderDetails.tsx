import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbList } from '../../../lib/rtdb';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  ArrowLeft, Clock, CheckCircle, Package, Truck, CheckCircle2, 
  XCircle, User, MapPin, CreditCard, Download, FileText, Printer,
  RefreshCcw, Check, X, ExternalLink, ShieldCheck, ShieldAlert, DollarSign, AlertCircle,
  Phone, Building2, Compass, Home, Info, AlertTriangle, Copy, Lock, Calendar, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  checkAndAutoReleaseVendorPayout, 
  releaseVendorPayout, 
  vendorReplyDispute, 
  AUTO_RELEASE_HOURS, 
  getCourierTrackingUrl, 
  isCodOrder,
  calculateOrderPaymentBreakdown 
} from '../../../services/vendorPayoutService';
import { recordPlatformFeeOnDelivery, reversePlatformFeeOnOrderCancellation } from '../../../services/platformFeeService';
import CourierVerificationModal from '../../../components/vendor/CourierVerificationModal';
import VendorCancelOrderModal from '../../../components/vendor/VendorCancelOrderModal';
import PaymentMethodSelectionModal from '../../../components/checkout/PaymentMethodSelectionModal';
import BkashPaymentModal from '../../../components/checkout/BkashPaymentModal';
import NagadPaymentModal from '../../../components/checkout/NagadPaymentModal';
import RocketPaymentModal from '../../../components/checkout/RocketPaymentModal';
import UpayPaymentModal from '../../../components/checkout/UpayPaymentModal';
import PaymentSuccessModal from '../../../components/payment/PaymentSuccessModal';
import { verifyPaymentAutomatic, type VerificationResult } from '../../../services/automaticPaymentVerificationService';
import { 
  getVendorWalletBalances, 
  checkResellerOrderEligibility, 
  confirmVendorResellerOrder, 
  type VendorWalletBalances,
  type ResellerOrderEligibilityResult
} from '../../../services/vendorResellerOrderService';
import { executeResellerWalletTransaction } from '../../../services/resellerWalletService';
import { ResellerTransactionType } from '../../../types/resellerWallet';
import VendorReportReturnModal from '../../../components/vendor/VendorReportReturnModal';
import { 
  vendorReportResellerOrderReturn, 
  getResellerReturnRequestByOrder, 
  type ResellerReturnRequestRecord 
} from '../../../services/resellerReturnService';

export interface ResolvedOrderDetails {
  name: string;
  mobile: string;
  altPhone: string;
  district: string;
  upazila: string;
  area: string;
  fullAddress: string;
  additionalNotes: string;
  itemsPrice: number;
  deliveryCharge: number;
  grandTotal: number;
  advanceAmount: number;
  codAmount: number;
  advanceLabel: string;
  isFullPayment: boolean;
  isOnlyDeliveryChargeAdvance: boolean;
}

export function resolveCustomerOrderDetails(order: any): ResolvedOrderDetails {
  if (!order) {
    return {
      name: 'Customer',
      mobile: 'N/A',
      altPhone: '',
      district: '',
      upazila: '',
      area: '',
      fullAddress: '',
      additionalNotes: '',
      itemsPrice: 0,
      deliveryCharge: 0,
      grandTotal: 0,
      advanceAmount: 0,
      codAmount: 0,
      advanceLabel: '০ টাকা',
      isFullPayment: false,
      isOnlyDeliveryChargeAdvance: false
    };
  }

  const name = 
    order?.customerName || 
    order?.shippingAddress?.name || 
    order?.shippingName || 
    order?.billingName || 
    'Customer';

  const mobile = 
    order?.customerPhone || 
    order?.shippingAddress?.mobile || 
    order?.shippingAddress?.phone || 
    order?.phone || 
    'N/A';

  const altPhone = 
    order?.customerAltPhone || 
    order?.shippingAddress?.altPhone || 
    order?.altPhone || 
    '';

  // Specific district resolution - strict user selection, no default fallbacks
  const rawDistrict = 
    order?.district || 
    order?.shippingAddress?.district || 
    order?.shippingSnapshot?.customerDeliveryLocation?.district || 
    '';

  // Specific upazila / thana resolution
  const rawUpazila = 
    order?.upazila || 
    order?.shippingAddress?.upazila || 
    order?.shippingAddress?.thana || 
    order?.shippingSnapshot?.customerDeliveryLocation?.upazila || 
    '';

  // Specific area resolution
  const rawArea = 
    order?.area || 
    order?.shippingAddress?.area || 
    order?.shippingSnapshot?.customerDeliveryLocation?.area || 
    '';

  // Full address
  const fullAddress = 
    order?.fullAddress || 
    order?.shippingAddress?.fullAddress || 
    order?.shippingAddress?.street || 
    order?.shippingSnapshot?.customerDeliveryLocation?.address || 
    '';

  // Additional notes or landmark
  const additionalNotes = 
    order?.additionalNotes || 
    order?.shippingAddress?.additionalNotes || 
    order?.shippingAddress?.notes || 
    '';

  const breakdown = calculateOrderPaymentBreakdown(order);

  return {
    name,
    mobile,
    altPhone,
    district: rawDistrict,
    upazila: rawUpazila,
    area: rawArea,
    fullAddress,
    additionalNotes,
    itemsPrice: breakdown.itemsPrice,
    deliveryCharge: breakdown.deliveryCharge,
    grandTotal: breakdown.grandTotal,
    advanceAmount: breakdown.advanceAmount,
    codAmount: breakdown.codAmount,
    advanceLabel: breakdown.advanceLabel,
    isFullPayment: breakdown.isFullPayment,
    isOnlyDeliveryChargeAdvance: breakdown.isOnlyDeliveryChargeAdvance
  };
}

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [releasingPayout, setReleasingPayout] = useState(false);
  const [vendorReplyText, setVendorReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  // Status updates
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  // Step 4: Reseller Order Balance Check & Deposit States
  const [vendorWalletBalances, setVendorWalletBalances] = useState<VendorWalletBalances | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [isConfirmingResellerOrder, setIsConfirmingResellerOrder] = useState(false);

  // Step 8: Reseller Order Return / Failed Delivery Reporting States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [isReportingReturn, setIsReportingReturn] = useState(false);
  const [existingReturnRequest, setExistingReturnRequest] = useState<ResellerReturnRequestRecord | null>(null);

  // Existing payment modals integration for deposit
  const [showPaymentSelectionModal, setShowPaymentSelectionModal] = useState(false);
  const [showBkashModal, setShowBkashModal] = useState(false);
  const [showNagadModal, setShowNagadModal] = useState(false);
  const [showRocketModal, setShowRocketModal] = useState(false);
  const [showUpayModal, setShowUpayModal] = useState(false);
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState(false);
  const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<'bkash' | 'nagad' | 'rocket' | 'upay' | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState('');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string>('');

  // Customer info copy states
  const [copiedCustomerInfo, setCopiedCustomerInfo] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn('navigator.clipboard writeText failed, trying fallback', err);
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      console.error('Fallback clipboard copy failed', err);
      return false;
    }
  };

  const handleCopyCustomerInfo = async () => {
    if (!order) return;
    const r = resolveCustomerOrderDetails(order);

    const lines: string[] = [
      `নাম: ${r.name}`,
      `মোবাইল: ${r.mobile}`
    ];

    if (r.altPhone) {
      lines.push(`বিকল্প মোবাইল: ${r.altPhone}`);
    }
    if (r.district) {
      lines.push(`জেলা: ${r.district}`);
    }
    if (r.upazila) {
      lines.push(`থানা/উপজেলা: ${r.upazila}`);
    }
    if (r.area) {
      lines.push(`এলাকা: ${r.area}`);
    }
    if (r.fullAddress) {
      lines.push(`সম্পূর্ণ ঠিকানা: ${r.fullAddress}`);
    }
    if (r.additionalNotes) {
      lines.push(`নোট/ল্যান্ডমার্ক: ${r.additionalNotes}`);
    }

    lines.push(`মোট অর্ডার মূল্য (পণ্য + ডেলিভারি): ৳${r.grandTotal.toLocaleString('bn-BD')}`);
    const advanceStr = `৳${r.advanceAmount.toLocaleString('bn-BD')}${r.isFullPayment ? ' (সম্পূর্ণ পরিশোধিত)' : ''}`;
    lines.push(`অগ্রিম পরিশোধ (Advance Paid): ${advanceStr}`);

    const codStr = r.codAmount === 0 
      ? '০ টাকা (সম্পূর্ণ মূল্য পরিশোধিত)' 
      : `৳${r.codAmount.toLocaleString('bn-BD')} (${r.codAmount} টাকা)`;
    lines.push(`ক্যাশ অন ডেলিভারি (COD কালেকশন): ${codStr}`);

    if (Array.isArray(order.items) && order.items.length > 0) {
      const itemsText = order.items
        .map((it: any) => `${it.title || it.name || 'পণ্য'} x ${it.quantity || 1}`)
        .join(', ');
      lines.push(`পণ্য: ${itemsText}`);
    }

    const orderCode = order.orderId || order.id;
    if (orderCode) {
      lines.push(`অর্ডার আইডি: #${orderCode}`);
    }

    const fullText = lines.join('\n');
    const success = await copyToClipboard(fullText);
    if (success) {
      setCopiedCustomerInfo(true);
      toast.success('কাস্টমারের নাম, ফোন, ঠিকানা ও সকল তথ্য সফলভাবে কপি হয়েছে!');
      setTimeout(() => setCopiedCustomerInfo(false), 2500);
    } else {
      toast.error('কপি করা সম্ভব হয়নি। অনুগ্রহ করে ম্যানুয়ালি সিলেক্ট করে কপি করুন।');
    }
  };

  const handleCopySingleField = async (text: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(label);
      toast.success(`${label} কপি হয়েছে!`);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  useEffect(() => {
    if (id && user) {
      fetchOrderDetails();
    }
  }, [id, user]);

  const fetchOrderDetails = async () => {
    try {
      // 1. Fetch Order from vendor_orders or orders in RTDB
      let orderData: any = await rtdbGet<any>(`vendor_orders/${id}`);
      if (!orderData && user) {
        orderData = await rtdbGet<any>(`vendor_orders/${id}_${user.uid}`);
      }

      // Fallback search if id is mainOrderId or has partial match (e.g. ORD-178998279679-863)
      if (!orderData) {
        try {
          const allVendorOrders = await rtdbGet<any>('vendor_orders') || {};
          const cleanId = (id || '').trim();
          const digitsOnly = cleanId.replace(/\D/g, '');
          
          let foundKey = Object.keys(allVendorOrders).find(k => 
            k === cleanId ||
            k.startsWith(cleanId) ||
            allVendorOrders[k]?.orderId === cleanId ||
            allVendorOrders[k]?.mainOrderId === cleanId
          );

          if (!foundKey && digitsOnly.length >= 8) {
            foundKey = Object.keys(allVendorOrders).find(k => {
              const kDigits = k.replace(/\D/g, '');
              const oIdDigits = String(allVendorOrders[k]?.orderId || '').replace(/\D/g, '');
              return (kDigits.length >= 8 && kDigits.includes(digitsOnly.slice(0, 10))) || 
                     (oIdDigits.length >= 8 && oIdDigits.includes(digitsOnly.slice(0, 10)));
            });
          }

          if (foundKey && allVendorOrders[foundKey]) {
            orderData = { id: foundKey, ...allVendorOrders[foundKey] };
          }
        } catch (e) {
          console.warn('Fallback vendor_orders scan failed:', e);
        }
      }

      if (orderData) {
        orderData = { id: orderData.id || id, ...orderData };
        // Merge with main order if available to ensure 100% address accuracy
        if (orderData.mainOrderId || orderData.orderId) {
          const mainId = orderData.mainOrderId || orderData.orderId;
          const mainOrder = await rtdbGet<any>(`orders/${mainId}`);
          if (mainOrder) {
            const isDelivered = 
              orderData.status === 'Delivered' || 
              orderData.vendorStatus === 'Delivered' ||
              mainOrder.status === 'Delivered' || 
              mainOrder.vendorStatus === 'Delivered' ||
              ((orderData.reviewSubmitted || orderData.reviewCompleted || mainOrder.reviewSubmitted || mainOrder.reviewCompleted) && (orderData.paymentMethod === 'cod' || mainOrder.paymentMethod === 'cod' || mainOrder.paymentGateway === 'Cash on Delivery'));

            orderData = {
              ...orderData,
              status: isDelivered ? 'Delivered' : (orderData.status || mainOrder.status || 'Confirmed'),
              vendorStatus: isDelivered ? 'Delivered' : (orderData.vendorStatus || mainOrder.vendorStatus || orderData.status || 'Confirmed'),
              deliveredAt: orderData.deliveredAt || mainOrder.deliveredAt,
              customerName: orderData.customerName || mainOrder.customerName || mainOrder.shippingAddress?.name,
              customerPhone: orderData.customerPhone || mainOrder.customerPhone || mainOrder.shippingAddress?.mobile,
              customerAltPhone: orderData.customerAltPhone || mainOrder.customerAltPhone || mainOrder.shippingAddress?.altPhone || '',
              district: orderData.district || orderData.shippingAddress?.district || mainOrder.district || mainOrder.shippingAddress?.district || '',
              upazila: orderData.upazila || orderData.shippingAddress?.upazila || mainOrder.upazila || mainOrder.shippingAddress?.upazila || '',
              area: orderData.area || orderData.shippingAddress?.area || mainOrder.area || mainOrder.shippingAddress?.area || '',
              fullAddress: orderData.fullAddress || orderData.shippingAddress?.fullAddress || mainOrder.fullAddress || mainOrder.shippingAddress?.fullAddress || '',
              additionalNotes: orderData.additionalNotes || orderData.shippingAddress?.additionalNotes || mainOrder.additionalNotes || mainOrder.shippingAddress?.additionalNotes || '',
              deliveryCharge: orderData.deliveryCharge ?? mainOrder.deliveryCharge ?? mainOrder.shippingCharge ?? 0,
              advancePaymentAmount: orderData.advancePaymentAmount ?? mainOrder.advancePaymentAmount,
              advancePaymentType: orderData.advancePaymentType ?? mainOrder.advancePaymentType,
              codAmount: orderData.codAmount ?? mainOrder.codAmount,
              shippingAddress: {
                ...(mainOrder.shippingAddress || {}),
                ...(orderData.shippingAddress || {})
              }
            };
          }
        }
      }

      if (!orderData) {
        const mData = await rtdbGet<any>(`orders/${id}`);
        if (mData) {
          const vItems = (mData.items || []).filter((it: any) => !it.vendorId || it.vendorId === user?.uid);
          const vSub = vItems.reduce((acc: number, it: any) => acc + ((it.price || 0) * (it.quantity || 1)), 0);
          const vDelCharge = mData.deliveryCharge || mData.shippingCharge || 0;
          orderData = {
            id,
            orderId: mData.orderId || id,
            mainOrderId: id,
            vendorId: mData.vendorId || user?.uid,
            customerId: mData.userId,
            customerName: mData.customerName || mData.shippingAddress?.name || 'Customer',
            customerEmail: mData.customerEmail || mData.shippingAddress?.email || '',
            customerPhone: mData.customerPhone || mData.shippingAddress?.mobile || '',
            customerAltPhone: mData.customerAltPhone || mData.shippingAddress?.altPhone || '',
            district: mData.district || mData.shippingAddress?.district || '',
            upazila: mData.upazila || mData.shippingAddress?.upazila || '',
            area: mData.area || mData.shippingAddress?.area || '',
            fullAddress: mData.fullAddress || mData.shippingAddress?.fullAddress || mData.shippingAddress?.street || '',
            additionalNotes: mData.additionalNotes || mData.shippingAddress?.additionalNotes || '',
            items: vItems.length > 0 ? vItems : mData.items,
            itemsCount: vItems.length || (mData.items || []).length,
            itemsPrice: vSub || mData.itemsPrice || mData.subtotal || mData.total,
            subtotal: vSub || mData.subtotal || mData.total,
            deliveryCharge: vDelCharge,
            shippingCharge: vDelCharge,
            grandTotal: mData.grandTotal || mData.total || (vSub + vDelCharge),
            advancePaymentAmount: mData.advancePaymentAmount,
            advancePaymentType: mData.advancePaymentType,
            codAmount: mData.codAmount,
            paymentMethod: mData.paymentMethod,
            paymentStatus: mData.paymentStatus,
            status: (mData.status === 'Delivered' || ((mData.reviewSubmitted || mData.reviewCompleted) && (mData.paymentMethod === 'cod' || mData.paymentGateway === 'Cash on Delivery'))) ? 'Delivered' : (mData.status || 'Pending'),
            vendorStatus: (mData.status === 'Delivered' || mData.vendorStatus === 'Delivered' || ((mData.reviewSubmitted || mData.reviewCompleted) && (mData.paymentMethod === 'cod' || mData.paymentGateway === 'Cash on Delivery'))) ? 'Delivered' : (mData.vendorStatus || mData.status || 'Pending'),
            courierName: mData.courierName || '',
            trackingNumber: mData.trackingNumber || mData.trackingId || '',
            trackingId: mData.trackingNumber || mData.trackingId || '',
            trackingUrl: mData.trackingUrl || '',
            createdAt: mData.createdAt || Date.now(),
            shippingAddress: mData.shippingAddress,
            isFromMainOrders: true
          };
        }
      }

      if (!orderData) {
        toast.error('Order not found');
        navigate('/vendor/orders');
        return;
      }
      
      // Verify owner
      if (orderData.vendorId !== user?.uid && (user as any)?.role !== 'Admin') {
        toast.error('Unauthorized access');
        navigate('/vendor/orders');
        return;
      }

      // Check auto release if in Release Pending state
      if (orderData.vendorPayoutStatus === 'Release Pending' && !orderData.dispute) {
        const autoRel = await checkAndAutoReleaseVendorPayout(orderData);
        if (autoRel.released) {
          orderData.vendorPayoutStatus = 'Released';
          toast.success('Payout auto-released to your wallet!');
        }
      }

      // Enrich with Reseller Order metadata if applicable from RTDB
      const mainOrdId = String(orderData.orderId || orderData.mainOrderId || id).replace(/^#/, '');
      try {
        const roData = (await rtdbGet<any>(`reseller_orders/${mainOrdId}`)) || orderData.priceSnapshot || orderData.resellerPriceSnapshot;
        if (roData) {
          orderData.isResellerOrder = true;
          orderData.resellerId = orderData.resellerId || roData.resellerId;
          orderData.resellerProfit = orderData.resellerProfit ?? roData.resellerProfit;
          orderData.profitStatus = orderData.profitStatus || roData.profitStatus || 'PENDING';
          orderData.vendorOrderStatus = orderData.vendorOrderStatus || roData.vendorOrderStatus;
          orderData.settlementStatus = orderData.settlementStatus || roData.settlementStatus;
          orderData.lockedProfitAmount = orderData.lockedProfitAmount ?? roData.lockedProfitAmount;
          orderData.lockTransactionId = orderData.lockTransactionId || roData.lockTransactionId;
          orderData.priceSnapshot = orderData.priceSnapshot || roData;
        }
      } catch (roErr) {
        console.warn('Reseller order lookup notice:', roErr);
      }
      
      setOrder(orderData);
      setTrackingNumber(orderData.trackingNumber || '');
      setCourierName(orderData.courierName || '');
      setTrackingUrl(orderData.trackingUrl || '');

      // Load vendor wallet balances if reseller order is detected
      if (user?.uid && Boolean(orderData.isResellerOrder || orderData.resellerId || orderData.profitStatus)) {
        try {
          setIsCheckingBalance(true);
          const balances = await getVendorWalletBalances(user.uid);
          setVendorWalletBalances(balances);
        } catch (wbErr) {
          console.warn('Vendor wallet balances check notice:', wbErr);
        } finally {
          setIsCheckingBalance(false);
        }

        // Check if there is an existing return request for this order in RTDB
        try {
          const retReq = await getResellerReturnRequestByOrder(orderData.orderId || id);
          setExistingReturnRequest(retReq);
        } catch (retErr) {
          console.warn('Existing return request check notice:', retErr);
        }
      }

      // 2. Fetch Items
      if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
        setItems(orderData.items);
      } else {
        const itemsList = await rtdbList<any>('order_items', (it) => it.orderId === id);
        setItems(itemsList.map(d => ({ id: d.id, ...d.data })));
      }

      // 3. Fetch Logs
      const logsList = await rtdbList<any>('order_status_logs', (l) => l.orderId === id || l.mainOrderId === id);
      const logsData = logsList.map(d => ({ id: d.id, ...d.data }));
      logsData.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setLogs(logsData);

    } catch (error) {
      console.error("Error fetching order details", error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // Helper to re-fetch wallet balances and order details
  const refreshWalletAndOrder = async () => {
    if (user?.uid) {
      try {
        const balances = await getVendorWalletBalances(user.uid);
        setVendorWalletBalances(balances);
      } catch (_) {}
    }
    await fetchOrderDetails();
  };

  // Calculate Reseller Order Profit Eligibility
  const resellerEligibility = useMemo<ResellerOrderEligibilityResult | null>(() => {
    if (!order || !vendorWalletBalances) return null;
    return checkResellerOrderEligibility(order, vendorWalletBalances);
  }, [order, vendorWalletBalances]);

  // Determine if this order is a Reseller Order and whether it has been Confirmed (Step 5 profit locked)
  const isResellerOrder = useMemo(() => {
    return Boolean(
      order?.isResellerOrder || 
      order?.resellerId || 
      order?.profitStatus || 
      order?.priceSnapshot?.resellerProfit
    );
  }, [order]);

  const isResellerConfirmed = useMemo(() => {
    return isResellerOrder && (
      order?.vendorOrderStatus === 'CONFIRMED' || 
      order?.profitStatus === 'LOCKED'
    );
  }, [isResellerOrder, order]);

  // Handle Backend Validated Confirmation for Reseller Orders
  const handleConfirmResellerOrder = async () => {
    if (!order || !user?.uid) return;
    try {
      setIsConfirmingResellerOrder(true);

      // 1. Re-fetch fresh wallet balances directly from RTDB before confirming
      const currentBalances = await getVendorWalletBalances(user.uid);
      setVendorWalletBalances(currentBalances);

      // Also ensure we have latest order data directly from RTDB
      const orderIdToConfirm = String(order.id || id).replace(/^#/, '');
      const freshOrder = (await rtdbGet<any>(`vendor_orders/${orderIdToConfirm}`)) ||
                          (await rtdbGet<any>(`orders/${orderIdToConfirm}`)) ||
                          order;
      const freshResellerOrder = await rtdbGet<any>(`reseller_orders/${orderIdToConfirm}`);
      const mergedOrder = { ...(freshResellerOrder || {}), ...(freshOrder || {}), ...order };

      const eligibility = checkResellerOrderEligibility(mergedOrder, currentBalances);

      // 2. Strict Balance Guard: availableBalance must be >= requiredResellerProfit
      // (Confirmation is ALLOWED if availableBalance >= requiredResellerProfit, even if exactly equal)
      if (!eligibility.isBalanceSufficient) {
        toast.error(
          eligibility.reason ||
          `Reseller profit reserve করার জন্য Vendor-এর wallet balance যথেষ্ট নয়। (প্রয়োজন: ৳${eligibility.requiredResellerProfit}, বর্তমান ঘাটতি: ৳${eligibility.shortfall})। অনুগ্রহ করে Deposit অপশন ব্যবহার করুন।`,
          { duration: 6000 }
        );
        // Automatically open existing Deposit Modal
        handleOpenDepositFlow();
        return;
      }

      // 3. Execute Step 5 Reseller Order Confirmation with atomic Profit Lock
      const res = await confirmVendorResellerOrder(orderIdToConfirm, user.uid);
      if (!res.success) {
        toast.error(res.message || 'অর্ডার কনফার্ম করা সম্ভব হয়নি।');
        if (res.error === 'INSUFFICIENT_WALLET_BALANCE') {
          handleOpenDepositFlow();
        }
        return;
      }

      toast.success(res.message || 'অর্ডারটি সফলভাবে কনফার্ম করা হয়েছে এবং রিসেলার প্রফিট লক করা হয়েছে!');
      await refreshWalletAndOrder();
      setShowCourierModal(true);
      try {
        window.dispatchEvent(new CustomEvent('vendor_order_updated'));
        window.dispatchEvent(new CustomEvent('reseller_profit_updated'));
      } catch (_) {}
    } catch (err: any) {
      console.error('Error confirming reseller order:', err);
      toast.error(err.message || 'কনফার্মেশন ত্রুটি');
    } finally {
      setIsConfirmingResellerOrder(false);
    }
  };

  // Step 8: Handle Vendor Return / Failed Delivery Report Submission
  const handleVendorReportReturn = async (reason: string) => {
    if (!order || !user?.uid) return;

    try {
      setIsReportingReturn(true);
      const res = await vendorReportResellerOrderReturn({
        orderId: order.orderId || order.id || id,
        vendorId: user.uid,
        reason: reason.trim(),
        reportedBy: user.email || (user as any).displayName || 'Vendor'
      });

      if (!res.success) {
        toast.error(res.message || 'রিটার্ন রিপোর্ট জমা দেওয়া সম্ভব হয়নি।');
        return;
      }

      toast.success(res.message || 'রিটার্ন রিকুয়েস্ট সফলভাবে জমা হয়েছে। অ্যাডমিন ভেরিফিকেশন সাপেক্ষে ব্যালেন্স সমন্বয় করা হবে।');
      setShowReturnModal(false);
      if (res.returnRequest) {
        setExistingReturnRequest(res.returnRequest);
      }
      await refreshWalletAndOrder();
    } catch (err: any) {
      console.error('Error reporting return:', err);
      toast.error(err.message || 'রিটার্ন রিপোর্ট জমা দেওয়ার সময় সমস্যা হয়েছে।');
    } finally {
      setIsReportingReturn(false);
    }
  };

  // Open Deposit Flow when available balance is less than required reseller profit
  const handleOpenDepositFlow = () => {
    if (!order) return;
    const required = Number(order.resellerProfit ?? order.priceSnapshot?.resellerProfit ?? 0);
    const avail = vendorWalletBalances?.availableBalance || 0;
    const shortfall = Math.max(required - avail, 10);

    const inv = 'DEP-VND-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    setCurrentInvoiceId(inv);
    setDepositAmount(shortfall);
    setSelectedPaymentChannel(null);
    setPaymentErrorMessage('');
    setShowPaymentSelectionModal(true);
  };

  // Selecting payment channel in PaymentMethodSelectionModal
  const handleConfirmPaymentChannel = (channel: 'bkash' | 'nagad' | 'rocket' | 'upay') => {
    setSelectedPaymentChannel(channel);
    setShowPaymentSelectionModal(false);
    setPaymentErrorMessage('');
    if (channel === 'bkash') setShowBkashModal(true);
    else if (channel === 'nagad') setShowNagadModal(true);
    else if (channel === 'rocket') setShowRocketModal(true);
    else if (channel === 'upay') setShowUpayModal(true);
  };

  // Complete deposit payment and credit vendor wallet balance
  const handleVerifyDepositPayment = async (
    channel: 'bkash' | 'nagad' | 'rocket' | 'upay',
    trxId: string
  ) => {
    const cleanTrx = (trxId || '').trim().replace(/\s+/g, '').toUpperCase();
    if (!cleanTrx) {
      const msg = 'অনুগ্রহ করে Transaction ID (TrxID) লিখুন';
      setPaymentErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (!user?.uid) {
      const msg = 'লগইন সেশন পাওয়া যায়নি। পুনরায় লগইন করুন।';
      setPaymentErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsVerifyingPayment(true);
    setPaymentErrorMessage('');

    try {
      // Call Automatic Payment Verification with strict 8-second safety timeout (matching Vendor/Reseller registration)
      const timeoutPromise = new Promise<VerificationResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error('পেমেন্ট যাচাইয়ের সময়সীমা শেষ হয়েছে (Timeout)। অনুগ্রহ করে আবার চেষ্টা করুন।'));
        }, 8000);
      });

      const result = await Promise.race([
        verifyPaymentAutomatic({
          transactionId: cleanTrx,
          paymentMethod: channel,
          expectedAmount: depositAmount,
          invoiceId: currentInvoiceId,
          userId: user.uid,
          userType: 'vendor',
          contextData: {
            type: 'vendor_wallet_deposit',
            action: 'vendor_wallet_deposit',
            orderId: order?.id || id,
            vendorId: user.uid,
            depositAmount
          }
        }),
        timeoutPromise
      ]);

      if (result.status === 'verified') {
        // Close channel modals
        setShowBkashModal(false);
        setShowNagadModal(false);
        setShowRocketModal(false);
        setShowUpayModal(false);
        setShowPaymentSelectionModal(false);

        // Open Success Modal
        setShowPaymentSuccessModal(true);

        // Refresh order and wallet
        await refreshWalletAndOrder();
        toast.success(`পেমেন্ট সফলভাবে যাচাই হয়েছে! ৳${depositAmount} ওয়ালেটে ডিপোজিট যোগ হয়েছে।`);
        return;
      } else {
        // Strict Rejection handling exactly following Registration verification rules
        let errorMsg = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
        if (result.rejectionReason === 'amount_mismatch') {
          errorMsg = result.message || `পেমেন্ট এমাউন্ট সঠিক নয়! প্রত্যাশিত: ৳${depositAmount.toFixed(2)}। সঠিক এমাউন্ট ডিপোজিট করুন।`;
        } else if (result.rejectionReason === 'method_mismatch') {
          errorMsg = result.message || 'পেমেন্ট মেথড সঠিক নয়! সঠিক পেমেন্ট মেথড ব্যবহার করুন।';
        } else if (result.rejectionReason === 'duplicate_transaction') {
          errorMsg = result.message || 'এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহৃত হয়েছে! একটি ট্রানজেকশন আইডি একাধিকবার ব্যবহার করা যাবে না।';
        } else if (result.message) {
          errorMsg = result.message;
        }
        setPaymentErrorMessage(errorMsg);
        toast.error(errorMsg, { duration: 6000 });
      }
    } catch (err: any) {
      console.error('Deposit verification error:', err);
      let errMsg = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
      if (err.message && err.message.includes('ইতিপূর্বে')) {
        errMsg = err.message;
      } else if (err.message && err.message.includes('Timeout')) {
        errMsg = err.message;
      }
      setPaymentErrorMessage(errMsg);
      toast.error(errMsg, { duration: 5000 });
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !newStatus) return;

    if (newStatus === 'Cancelled') {
      setShowStatusModal(false);
      setShowCancelModal(true);
      return;
    }
    
    setUpdating(true);
    try {
      let resolvedTrackingUrl = trackingUrl.trim();
      if (resolvedTrackingUrl && !resolvedTrackingUrl.startsWith('http://') && !resolvedTrackingUrl.startsWith('https://')) {
        resolvedTrackingUrl = 'https://' + resolvedTrackingUrl;
      }
      if (!resolvedTrackingUrl && (courierName.trim() || trackingNumber.trim())) {
        resolvedTrackingUrl = getCourierTrackingUrl(courierName.trim(), trackingNumber.trim());
      }

      const updateData: any = { 
        status: newStatus,
        updatedAt: Date.now()
      };
      
      if (courierName || trackingNumber || resolvedTrackingUrl || newStatus === 'Shipped' || newStatus === 'Accepted') {
        updateData.trackingNumber = trackingNumber.trim();
        updateData.trackingId = trackingNumber.trim();
        updateData.courierName = courierName.trim();
        updateData.trackingUrl = resolvedTrackingUrl;
      }

      // Record stage timestamps for 7-step tracking
      if (newStatus === 'Accepted' && !order.acceptedAt) {
        updateData.acceptedAt = Date.now();
      }
      if (newStatus === 'Shipped' && !order.shippedAt) {
        updateData.shippedAt = Date.now();
      }
      if (newStatus === 'In Transit' && !order.inTransitAt) {
        updateData.inTransitAt = Date.now();
      }
      if (newStatus === 'Out for Delivery' && !order.outForDeliveryAt) {
        updateData.outForDeliveryAt = Date.now();
      }

      // If Delivered: COD orders never credit wallet or set payout hold!
      // Online orders hold released after 4 days from payment.
      if (newStatus === 'Delivered') {
        updateData.deliveredAt = Date.now();
        const isCod = isCodOrder(order);
        if (isCod) {
          updateData.vendorPayoutStatus = 'None';
          updateData.paymentStatus = 'Paid';
        } else {
          updateData.vendorPayoutStatus = 'Held';
          if (!order.autoReleaseAt) {
            const paymentTime = order.paidAt || order.createdAt || Date.now();
            updateData.autoReleaseAt = paymentTime + (AUTO_RELEASE_HOURS * 60 * 60 * 1000);
          }
        }
      }

      await rtdbUpdate(`vendor_orders/${order.id}`, updateData);

      // Sync status to main orders collection so Customer's My Orders updates
      const mainOrderId = order.mainOrderId || order.orderId || order.id;
      try {
        const mainOrderUpdate: any = {
          ...updateData,
          vendorStatus: newStatus,
        };
        await rtdbUpdate(`orders/${mainOrderId}`, mainOrderUpdate);
      } catch (err) {
        console.warn("Error updating main orders doc in RTDB", err);
      }
      
      // Reseller Profit logic when Delivered (Atomic RTDB transaction)
      if (newStatus === 'Delivered') {
        try {
          const transList = await rtdbList<any>('reseller_transactions', (t) => t.orderId === (order.orderId || order.id));
          for (const trans of transList) {
            const transData = trans.data;
            if (transData.status === 'Pending' && transData.resellerId) {
              await rtdbUpdate(`reseller_transactions/${trans.id}`, {
                status: 'Approved',
                updatedAt: Date.now()
              });
              
              const ordId = order.orderId || order.id;
              await executeResellerWalletTransaction({
                resellerId: transData.resellerId,
                userId: transData.resellerId,
                orderId: ordId,
                amount: Number(transData.amount) || 0,
                type: ResellerTransactionType.PROFIT_RELEASED,
                status: 'Approved',
                description: `Profit released for Delivered vendor order #${ordId}`
              });
            }
          }
        } catch (error) {
          console.error('Error updating reseller profit in RTDB', error);
        }

        // User Referral logic when Delivered
        try {
          const refList = await rtdbList<any>('user_referral_transactions', (t) => t.orderId === (order.orderId || order.id));
          for (const trans of refList) {
            const transData = trans.data;
            if (transData.status === 'Pending') {
              await rtdbUpdate(`user_referral_transactions/${trans.id}`, {
                status: 'Approved',
                updatedAt: Date.now()
              });
              
              const wData = await rtdbGet<any>(`user_wallet/${transData.referrerId}`) || {};
              await rtdbUpdate(`user_wallet/${transData.referrerId}`, {
                pendingCommission: Math.max(0, (wData.pendingCommission || 0) - (transData.amount || 0)),
                approvedCommission: (wData.approvedCommission || 0) + (transData.amount || 0),
                walletBalance: (wData.walletBalance || 0) + (transData.amount || 0)
              });
            }
          }
        } catch (error) {
          console.error('Error updating user referral profit in RTDB', error);
        }

        // Platform Fee for COD Orders (Only when Delivered)
        try {
          await recordPlatformFeeOnDelivery(order.id, { ...order, status: newStatus }, user?.uid);
        } catch (feeErr) {
          console.warn('Notice: Error recording platform fee:', feeErr);
        }
      } else if (newStatus === 'Cancelled' || newStatus === 'Returned') {
        try {
          await reversePlatformFeeOnOrderCancellation(order.id, user?.uid);
        } catch (feeErr) {
          console.warn('Notice: Error reversing platform fee:', feeErr);
        }
      }

      // Add Log
      await rtdbPush('order_status_logs', {
        orderId: order.id,
        vendorId: user?.uid,
        oldStatus: order.status,
        newStatus: newStatus,
        note: statusNote,
        timestamp: Date.now()
      });

      // Notify Customer
      await rtdbPush('vendor_notifications', {
        userId: order.customerId, 
        title: `Order Status Updated: ${newStatus}`,
        message: `Your order #${order.orderId?.substring(0,8)} is now ${newStatus}. ${statusNote}`,
        read: false,
        type: 'order_update',
        timestamp: Date.now(),
        link: `/orders/${order.id}`
      });

      toast.success(`Order marked as ${newStatus}`);
      setShowStatusModal(false);
      setNewStatus('');
      setStatusNote('');
      fetchOrderDetails();
    } catch (error) {
      console.error("Error updating status", error);
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!order) return;
    
    try {
      await rtdbUpdate(`vendor_orders/${order.id}`, {
        paymentStatus: 'Paid',
        updatedAt: Date.now()
      });
      
      await rtdbPush('order_status_logs', {
        orderId: order.id,
        vendorId: user?.uid,
        oldStatus: order.status,
        newStatus: order.status,
        note: 'Payment manually confirmed by vendor.',
        timestamp: Date.now()
      });
      
      toast.success('Payment confirmed successfully');
      fetchOrderDetails();
    } catch (error) {
      console.error("Error confirming payment", error);
      toast.error('Failed to confirm payment');
    }
  };

  const generateInvoice = () => {
    // In a real app, this would use a PDF generation library or navigate to a print view.
    window.print();
  };

  if (loading) {
    return (
      <VendorLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200  rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg gap-6">
            <div className="lg space-y-6">
              <div className="h-64 bg-gray-200  rounded-2xl"></div>
              <div className="h-64 bg-gray-200  rounded-2xl"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-gray-200  rounded-2xl"></div>
              <div className="h-48 bg-gray-200  rounded-2xl"></div>
            </div>
          </div>
        </div>
      </VendorLayout>
    );
  }

  if (!order) return null;

  const resolved = resolveCustomerOrderDetails(order);

  const hasApprovedOrPendingCourier = 
    order.courierVerificationStatus === 'Pending — Admin Review' || 
    order.courierVerificationStatus === 'Verified' || 
    order.courierAdminApproved;

  const isInCourierDeliveryCycle = [
    'Shipped',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Returned'
  ].includes(order.status);

  // An order can be Accepted or Cancelled by the vendor if it has not yet been accepted, shipped, delivered, or cancelled
  const isAlreadyProcessed = [
    'Accepted',
    'Shipped',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Refunded',
    'Rejected',
    'Returned'
  ].includes(order.status) || [
    'Accepted',
    'Shipped',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Refunded',
    'Rejected',
    'Returned'
  ].includes(order.vendorStatus) || Boolean(order.acceptedAt);

  const canAcceptOrCancel = !isAlreadyProcessed && !hasApprovedOrPendingCourier && !isInCourierDeliveryCycle;

  const validNextStatuses = () => {
    // Rule: Vendor cannot manually change order status once courier is linked or in delivery cycle
    if (hasApprovedOrPendingCourier || isInCourierDeliveryCycle) {
      return [];
    }
    switch(order.status) {
      case 'Pending': 
      case 'Confirmed':
        return ['Accepted', 'Cancelled'];
      case 'Accepted': return ['Cancelled'];
      default: return [];
    }
  };

  const handleQuickStatusChange = async (targetStatus: 'Accepted' | 'Rejected') => {
    if (!order || !user) return;
    if (hasApprovedOrPendingCourier || isInCourierDeliveryCycle) {
      alert('কুরিয়ার ট্র্যাকিং লিংক সংযুক্ত রয়েছে। অর্ডার স্ট্যাটাস অফিশিয়াল কুরিয়ার পেজ থেকে স্বয়ংক্রিয়ভাবে আপডেট হচ্ছে (Picked Up → In Transit → Out for Delivery → Delivered → Returned)। ভেন্ডর নিজে স্ট্যাটাস পরিবর্তন করতে পারবেন না।');
      return;
    }
    if (targetStatus === 'Rejected') {
      setShowCancelModal(true);
      return;
    }

    setUpdating(true);
    try {
      const updateData: any = {
        status: targetStatus,
        updatedAt: Date.now()
      };
      if (targetStatus === 'Accepted') {
        updateData.acceptedAt = Date.now();
      }

      // Update vendor_orders in RTDB
      const vendorDocId = order.id || `${order.mainOrderId || order.orderId}_${user?.uid}`;
      await rtdbUpdate(`vendor_orders/${vendorDocId}`, updateData);
      if (order.id && order.id !== vendorDocId) {
        await rtdbUpdate(`vendor_orders/${order.id}`, updateData).catch(() => {});
      }

      // Update main orders collection for Customer's My Orders
      const mainOrderId = order.mainOrderId || order.orderId || order.id;
      try {
        await rtdbUpdate(`orders/${mainOrderId}`, {
          status: targetStatus,
          vendorStatus: targetStatus,
          acceptedAt: targetStatus === 'Accepted' ? Date.now() : undefined,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.warn("Error updating main orders doc in RTDB", err);
      }

      // Add Log
      await rtdbPush('order_status_logs', {
        orderId: order.id,
        mainOrderId: mainOrderId,
        vendorId: user?.uid,
        oldStatus: order.status || 'Pending',
        newStatus: targetStatus,
        note: targetStatus === 'Accepted' ? 'Order accepted by vendor. Awaiting courier tracking link.' : 'Order updated by vendor.',
        timestamp: Date.now()
      });

      // Notify Customer
      try {
        await rtdbPush('vendor_notifications', {
          userId: order.customerId, 
          title: `Order Status Updated: ${targetStatus}`,
          message: `Your order #${order.orderId?.substring(0,8)} is now ${targetStatus}.`,
          read: false,
          type: 'order_update',
          timestamp: Date.now(),
          link: `/orders/${order.id}`
        });
      } catch (e) {
        console.warn('Error adding notification in RTDB', e);
      }

      if (targetStatus === 'Accepted') {
        toast.success(`অর্ডার #${order.orderId?.substring(0, 8)} গ্রহণ করা হয়েছে!`);
        await fetchOrderDetails();
        // Immediately open existing Courier Tracking modal as per Requirement 2
        setShowCourierModal(true);
      }
    } catch (error) {
      console.error(`Error marking order as ${targetStatus}`, error);
      toast.error(`Failed to mark order as ${targetStatus}`);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusIcon = (status: string, className = "w-5 h-5") => {
    switch(status) {
      case 'Pending': return <Clock className={className} />;
      case 'Accepted': return <CheckCircle2 className={`${className} text-emerald-600`} />;
      case 'Rejected': return <XCircle className={`${className} text-red-600`} />;
      case 'Confirmed': return <CheckCircle className={className} />;
      case 'Processing': return <RefreshCcw className={className} />;
      case 'Packed': return <Package className={className} />;
      case 'Shipped': return <Truck className={`${className} text-sky-600`} />;
      case 'In Transit': return <Truck className={`${className} text-indigo-600`} />;
      case 'Out for Delivery': return <Truck className={`${className} text-cyan-600`} />;
      case 'Delivered': return <CheckCircle2 className={`${className} text-emerald-600`} />;
      case 'Cancelled': return <XCircle className={`${className} text-red-600`} />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Pending': return 'text-amber-700 bg-amber-100 border border-amber-200';
      case 'Accepted': return 'text-emerald-800 bg-emerald-100 border border-emerald-200';
      case 'Rejected': return 'text-red-800 bg-red-100 border border-red-200';
      case 'Confirmed': return 'text-blue-600 bg-blue-100 border border-blue-200';
      case 'Processing': return 'text-indigo-600 bg-indigo-100 border border-indigo-200';
      case 'Packed': return 'text-purple-600 bg-purple-100 border border-purple-200';
      case 'Shipped': return 'text-sky-700 bg-sky-100 border border-sky-200';
      case 'In Transit': return 'text-indigo-700 bg-indigo-100 border border-indigo-200';
      case 'Out for Delivery': return 'text-cyan-800 bg-cyan-100 border border-cyan-200';
      case 'Delivered': return 'text-emerald-700 bg-emerald-100 border border-emerald-200';
      case 'Cancelled': return 'text-red-600 bg-red-100 border border-red-200';
      default: return 'text-gray-600 bg-gray-100 border border-gray-200';
    }
  };

  return (
    <VendorLayout>
      {/* Top Header / Breadcrumbs, Order Information & Status Actions */}
      <div className="mb-5">
        <button 
          onClick={() => navigate('/vendor/orders')}
          className="flex items-center text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-2.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Orders
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Order Identity & Time */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-base sm:text-xl font-extrabold text-gray-950 flex items-center gap-2">
                <span>Order #{order.orderId || order.id}</span>
                <button
                  type="button"
                  onClick={(e) => handleCopySingleField(order.orderId || order.id, 'অর্ডার আইডি', e)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                  title="অর্ডার আইডি কপি করুন"
                >
                  {copiedField === 'অর্ডার আইডি' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
                {getStatusIcon(order.status, "w-3.5 h-3.5")}
                <span>{order.status}</span>
              </span>
              {Boolean(order.isResellerOrder || order.resellerId || order.profitStatus) && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                  <span>Reseller Order</span>
                  <span className="text-[10px] opacity-80 font-mono">({order.profitStatus || 'PENDING'})</span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>অর্ডারের সময়: {order.createdAt ? new Date(order.createdAt).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span>
            </p>
          </div>

          {/* Primary Action Controls */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canAcceptOrCancel && (
              <>
                {/* For Reseller Orders: balance check governs confirmation */}
                {isResellerOrder ? (
                  <>
                    <button
                      type="button"
                      onClick={handleConfirmResellerOrder}
                      disabled={updating || isConfirmingResellerOrder}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="অর্ডার কনফার্ম করুন"
                    >
                      {isConfirmingResellerOrder ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>অর্ডার কনফার্ম করুন</span>
                    </button>

                    {resellerEligibility && !resellerEligibility.isBalanceSufficient && (
                      <button
                        type="button"
                        onClick={handleOpenDepositFlow}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer animate-pulse"
                        title="Required Reseller Profit Deposit"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Deposit Balance (ঘাটতি ৳{resellerEligibility.shortfall})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      disabled={updating || isConfirmingResellerOrder}
                      className="px-3.5 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      title="Cancel Order"
                    >
                      <X className="w-4 h-4" />
                      Cancel Order
                    </button>
                  </>
                ) : (
                  /* Standard Non-Reseller Order Flow (100% Untouched) */
                  <>
                    <button
                      type="button"
                      onClick={() => handleQuickStatusChange('Accepted')}
                      disabled={updating}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      title="Accept Order"
                    >
                      <Check className="w-4 h-4" />
                      Accept Order
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      disabled={updating}
                      className="px-3.5 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      title="Cancel Order"
                    >
                      <X className="w-4 h-4" />
                      Cancel Order
                    </button>
                  </>
                )}
              </>
            )}

            <button 
              onClick={generateInvoice}
              className="px-3.5 py-2 bg-white border border-gray-200 text-gray-700 font-medium text-xs sm:text-sm rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-gray-500" />
              Print Invoice
            </button>

            {/* Reseller Order Confirmed - Top Bar Courier Tracking Link Option */}
            {isResellerOrder && isResellerConfirmed && !['Cancelled', 'Refunded', 'Returned'].includes(order.status) && (
              order.courierVerificationStatus === 'Pending — Admin Review' ? (
                <div className="px-3.5 py-2 bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-2xs">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>লিংক লক করা (রিভিউ চলছে)</span>
                </div>
              ) : order.courierVerificationStatus === 'Rejected' ? (
                <button
                  type="button"
                  onClick={() => setShowCourierModal(true)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>🔄 নতুন সঠিক কুরিয়ার লিংক দিন</span>
                </button>
              ) : (order.courierVerificationStatus === 'Verified' || order.courierAdminApproved) ? (
                <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>কুরিয়ার লিংক অনুমোদিত</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCourierModal(true)}
                  className="px-4 py-2 bg-primary-main hover:bg-sky-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer animate-pulse"
                  title="কুরিয়ার ট্র্যাকিং লিংক দিন"
                >
                  <Truck className="w-4 h-4" />
                  <span>{order.trackingUrl ? 'কুরিয়ার লিংক আপডেট করুন' : 'কুরিয়ার ট্র্যাকিং লিংক দিন'}</span>
                </button>
              )
            )}

            {!canAcceptOrCancel && validNextStatuses().length > 0 && (
              <button 
                onClick={() => setShowStatusModal(true)}
                className="px-3.5 py-2 bg-slate-900 text-white font-medium text-xs sm:text-sm rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
              >
                Update Status
              </button>
            )}

            {/* Step 8 & 9: Reseller Order - Report Return / Profit Reversal Button */}
            {Boolean(order.isResellerOrder || order.resellerId) && 
              (order.profitStatus === 'LOCKED' || order.profitStatus === 'RELEASED') && 
              order.status !== 'Cancelled' && 
              order.status !== 'Returned' && (
              <button
                type="button"
                onClick={() => setShowReturnModal(true)}
                disabled={existingReturnRequest?.returnStatus === 'PENDING_ADMIN_REVIEW' || existingReturnRequest?.returnStatus === 'APPROVED'}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors shadow-2xs ${
                  existingReturnRequest?.returnStatus === 'PENDING_ADMIN_REVIEW'
                    ? 'bg-amber-50 text-amber-800 border border-amber-300 cursor-default'
                    : existingReturnRequest?.returnStatus === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 cursor-default'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer'
                }`}
                title="রিটার্ন বা ডেলিভারি ফেইলিউর রিপোর্ট করুন"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {existingReturnRequest?.returnStatus === 'PENDING_ADMIN_REVIEW'
                    ? 'Return Review Pending'
                    : existingReturnRequest?.returnStatus === 'APPROVED'
                    ? 'Return Approved'
                    : order.profitStatus === 'RELEASED'
                    ? 'Request Reversal'
                    : 'Report Return'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Reseller Order Breakdown & Vendor Wallet Reserve Status Panel */}
        {Boolean(order.isResellerOrder || order.resellerId || order.profitStatus) && (
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-purple-950">রিসেলার অর্ডার বিবরণ (Reseller Order Details)</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-800 uppercase tracking-wide">
                      Profit: {order.profitStatus || 'PENDING'}
                    </span>
                  </div>
                  <p className="text-xs text-purple-700">
                    রিসেলার আইডি (Reseller ID): <span className="font-mono font-bold text-purple-900">{order.resellerId || 'N/A'}</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-purple-800 font-bold block tracking-wide">Reseller Profit Reserve Required</span>
                <span className="text-base sm:text-2xl font-black text-purple-900">
                  ৳{Number(order.resellerProfit ?? order.priceSnapshot?.resellerProfit ?? 0).toLocaleString('bn-BD')}
                </span>
              </div>
            </div>

            {/* Vendor Wallet Balance Statistics - Available, Locked, Total Balance (Distinctly Separated) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white/90 p-3 rounded-xl border border-purple-100 shadow-2xs">
              <div className="px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                <span className="text-[11px] font-semibold text-emerald-800 block">আপনার Available Balance</span>
                <span className="text-base font-extrabold text-emerald-950">
                  ৳{Number(vendorWalletBalances?.availableBalance ?? 0).toLocaleString('bn-BD')}
                </span>
              </div>

              <div className="px-3 py-2 rounded-lg bg-amber-50/70 border border-amber-100">
                <span className="text-[11px] font-semibold text-amber-800 block">লকড ব্যালেন্স (Locked Balance)</span>
                <span className="text-base font-extrabold text-amber-950">
                  ৳{Number(vendorWalletBalances?.lockedBalance ?? 0).toLocaleString('bn-BD')}
                </span>
              </div>

              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-700 block">মোট ব্যালেন্স (Total Balance)</span>
                <span className="text-base font-extrabold text-slate-900">
                  ৳{Number(vendorWalletBalances?.totalBalance ?? 0).toLocaleString('bn-BD')}
                </span>
              </div>
            </div>

            {/* If Profit is LOCKED / Order is CONFIRMED by Vendor */}
            {(order.profitStatus === 'LOCKED' || order.vendorOrderStatus === 'CONFIRMED') && (
              <div className="p-4 bg-purple-100/70 border border-purple-300 rounded-xl text-xs text-purple-950 flex items-start gap-3 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-purple-950 text-sm">রিসেলার প্রফিট লকড (Reseller Profit Locked)</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-200 text-purple-900 uppercase">
                      vendorOrderStatus: {order.vendorOrderStatus || 'CONFIRMED'}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-200 text-purple-900 uppercase">
                      profitStatus: {order.profitStatus || 'LOCKED'}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-200 text-purple-900 uppercase">
                      settlementStatus: {order.settlementStatus || 'LOCKED'}
                    </span>
                  </div>
                  <p className="text-purple-800 leading-relaxed font-medium">
                    অর্ডার কনফার্ম করার সময় প্রয়োজনীয় রিসেলার প্রফিট (<strong>৳{Number(order.lockedProfitAmount ?? order.resellerProfit ?? 0).toLocaleString('bn-BD')}</strong>) আপনার Available Balance থেকে <strong>Locked Balance</strong>-এ সিকিউরিটি হিসেবে স্থানান্তর করা হয়েছে।
                    {order.paymentMethod?.toLowerCase() === 'cod' && ' (COD অর্ডারের ক্ষেত্রে প্ল্যাটফর্ম কোনো পেমেন্ট সংগ্রহ করে না; ভেন্ডর ওয়ালেটের এই লকড রিজার্ভই রিসেলার প্রফিটের নিরাপত্তা হিসেবে সংরক্ষিত রয়েছে।)'}
                  </p>
                  {order.lockTransactionId && (
                    <div className="text-[11px] font-mono text-purple-800/80 pt-0.5">
                      Transaction ID: <span className="font-bold text-purple-950">{order.lockTransactionId}</span>
                    </div>
                  )}

                  {/* Step 8: Return / Failed Delivery Status or Action */}
                  <div className="pt-2 border-t border-purple-200/80 mt-2 flex flex-wrap items-center justify-between gap-2">
                    {existingReturnRequest ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-purple-950">Return Request:</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                          existingReturnRequest.returnStatus === 'PENDING_ADMIN_REVIEW'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : existingReturnRequest.returnStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}>
                          {existingReturnRequest.returnStatus.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-purple-800 truncate max-w-xs">
                          (কারণ: {existingReturnRequest.reason})
                        </span>
                      </div>
                    ) : (
                      order.status !== 'Cancelled' && order.status !== 'Returned' && (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs text-purple-900 font-medium">
                            {order.profitStatus === 'RELEASED'
                              ? 'পণ্য কাস্টমার পরে ফেরত দিলে বা রিফান্ড চাইলে প্রফিট রিভার্সাল রিকুয়েস্ট করুন:'
                              : 'পণ্য কাস্টমার ফেরত দিলে অথবা ডেলিভারি ফেইল্ড হলে রিপোর্ট করুন:'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowReturnModal(true)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {order.profitStatus === 'RELEASED' ? 'Request Reversal' : 'Report Return'}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Balance Check Feedback Banner */}
            {resellerEligibility && order.status === 'Pending' && order.profitStatus !== 'LOCKED' && order.vendorOrderStatus !== 'CONFIRMED' && (
              <div>
                {resellerEligibility.isBalanceSufficient ? (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-emerald-950 text-sm mb-0.5">
                        পর্যাপ্ত ওয়ালেট ব্যালেন্স (Available Balance Sufficient)
                      </div>
                      <p className="text-emerald-800 leading-relaxed">
                        আপনার ওয়ালেটে পর্যাপ্ত availableBalance রয়েছে (৳{resellerEligibility.availableBalance}) যা প্রয়োজনীয় Reseller Profit Reserve (৳{resellerEligibility.requiredResellerProfit})-এর সমান বা বেশি। আপনি এখন অর্ডারটি কনফার্ম করতে পারেন।
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-950 text-sm mb-1">
                          Reseller profit reserve করার জন্য Vendor-এর wallet balance যথেষ্ট নয়
                        </div>
                        <p className="text-amber-800 font-medium">
                          Reseller Profit Reserve Required: <span className="font-bold text-purple-900">৳{resellerEligibility.requiredResellerProfit}</span> | আপনার Available Balance: <span className="font-bold text-slate-900">৳{resellerEligibility.availableBalance}</span> | বর্তমান ঘাটতি: <span className="font-bold text-red-600">৳{resellerEligibility.shortfall}</span>
                        </p>
                        <p className="text-[11px] text-amber-700 mt-1">
                          অর্ডারটি কনফার্ম করতে অনুগ্রহ করে নিচের <strong>Deposit</strong> অপশন ব্যবহার করুন।
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenDepositFlow}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Deposit</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Line items pricing breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-purple-800 border-b border-purple-200 font-semibold bg-purple-100/50">
                    <th className="px-3 py-2.5 rounded-l-lg">পণ্য (Product)</th>
                    <th className="px-3 py-2.5 text-center">পরিমাণ (Qty)</th>
                    <th className="px-3 py-2.5 text-right">ভেন্ডর মূল্য (Vendor Price)</th>
                    <th className="px-3 py-2.5 text-right">রিসেলার বিক্রয় মূল্য (Selling Price)</th>
                    <th className="px-3 py-2.5 text-right rounded-r-lg">রিসেলার প্রফিট (Profit)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100/70 font-medium">
                  {((order.priceSnapshot?.items && Array.isArray(order.priceSnapshot.items) && order.priceSnapshot.items.length > 0) ? order.priceSnapshot.items : items).map((it: any, idx: number) => {
                    const vp = Number(it.vendorPrice ?? it.adminPrice ?? it.price ?? 0);
                    const sp = Number(it.resellerSellingPrice ?? it.price ?? vp);
                    const qty = Number(it.quantity || 1);
                    const prof = Number(it.resellerProfit ?? Math.max(0, (sp - vp) * qty));
                    return (
                      <tr key={idx} className="hover:bg-purple-100/40">
                        <td className="px-3 py-2.5 font-bold text-purple-950">
                          {it.productName || it.name || 'Product'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-purple-900 font-bold">x{qty}</td>
                        <td className="px-3 py-2.5 text-right text-purple-900">৳{vp.toLocaleString('bn-BD')}</td>
                        <td className="px-3 py-2.5 text-right text-purple-900">৳{sp.toLocaleString('bn-BD')}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold text-purple-700">৳{prof.toLocaleString('bn-BD')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vendor notice */}
            <div className="p-3 bg-white/95 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start gap-2 shadow-2xs">
              <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-purple-900">ভেন্ডর অবগতি বার্তা:</span> এই অর্ডারটি একজন নিবন্ধিত রিসেলারের মাধ্যমে তৈরি হয়েছে। 
                অর্ডার কনফার্ম করার জন্য ভেন্ডর ওয়ালেটে প্রয়োজনীয় রিসেলার প্রফিট রিজার্ভ ব্যালেন্স (৳{Number(order.resellerProfit ?? 0).toLocaleString('bn-BD')}) থাকা আবশ্যক। 
                এই ধাপে কোনো ব্যালেন্স কাটা হবে না এবং লকড ব্যালেন্সেও পাঠানো হবে না; এটি পরবর্তী ধাপ ৫-এ হবে।
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Left Column - Order Items & Logs */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Order Items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-100">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                Order Items ({items.length})
              </h2>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs">
                    <th className="px-4 py-2.5 font-semibold">Product</th>
                    <th className="px-4 py-2.5 font-semibold">Price</th>
                    <th className="px-4 py-2.5 font-semibold">Qty</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 mr-3 border border-gray-200">
                            {item.image ? (
                              <img referrerPolicy="no-referrer" src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 m-2.5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-1">{item.name}</p>
                            {item.variant && <p className="text-[11px] text-gray-500">Variant: {item.variant}</p>}
                            {(item.selectedColor || item.color || item.selectedSize || item.size || item.variantSku || item.sku) && (
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {(item.selectedColor || item.color) && (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.5 rounded">
                                    Color: {item.selectedColor || item.color}
                                  </span>
                                )}
                                {(item.selectedSize || item.size) && (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.5 rounded">
                                    Size: {item.selectedSize || item.size}
                                  </span>
                                )}
                                {(item.variantSku || item.sku) && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded">
                                    SKU: {item.variantSku || item.sku}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs sm:text-sm text-gray-600 font-medium">
                        ৳{(item.price || 0).toLocaleString('bn-BD')}
                      </td>
                      <td className="px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900">
                        x{item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-xs sm:text-sm font-bold text-gray-900">
                        ৳{((item.price || 0) * (item.quantity || 1)).toLocaleString('bn-BD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="p-3 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                    {item.image ? (
                      <img referrerPolicy="no-referrer" src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 m-3 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                    {item.variant && <p className="text-[10px] text-gray-500">Variant: {item.variant}</p>}
                    {(item.selectedColor || item.color || item.selectedSize || item.size || item.variantSku || item.sku) && (
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {(item.selectedColor || item.color) && (
                          <span className="text-[9px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.2 rounded">
                            {item.selectedColor || item.color}
                          </span>
                        )}
                        {(item.selectedSize || item.size) && (
                          <span className="text-[9px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.2 rounded">
                            {item.selectedSize || item.size}
                          </span>
                        )}
                        {(item.variantSku || item.sku) && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.2 rounded">
                            {item.variantSku || item.sku}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-gray-500">৳{(item.price || 0).toLocaleString('bn-BD')} x {item.quantity}</span>
                      <span className="font-bold text-gray-900">৳{((item.price || 0) * (item.quantity || 1)).toLocaleString('bn-BD')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Totals & Breakdown */}
            <div className="p-3 sm:p-4 bg-gray-50 flex flex-col items-end">
              <div className="w-full sm:w-2/3 md:w-1/2 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>পণ্য মূল্য (Items Subtotal)</span>
                  <span className="font-semibold text-gray-900">৳{resolved.itemsPrice.toLocaleString('bn-BD')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>ডেলিভারি চার্জ (Delivery Charge)</span>
                  <span className="font-semibold text-gray-900">+ ৳{resolved.deliveryCharge.toLocaleString('bn-BD')}</span>
                </div>
                {order.discount ? (
                  <div className="flex justify-between text-gray-600">
                    <span>ছাড় (Discount)</span>
                    <span className="font-semibold text-red-600">- ৳{Number(order.discount).toLocaleString('bn-BD')}</span>
                  </div>
                ) : null}
                <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm sm:text-base font-bold text-gray-900">
                  <span>মোট মূল্য (Total Amount):</span>
                  <span className="text-primary-main">৳{resolved.grandTotal.toLocaleString('bn-BD')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Logs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 print:hidden">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-gray-400" />
              Order Activity
            </h2>
            <div className="relative border-l border-gray-200 ml-2 space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="relative pl-5">
                  <span className={`absolute -left-2.5 flex items-center justify-center w-5 h-5 rounded-full ring-2 ring-white ${getStatusColor(log.newStatus)}`}>
                    {getStatusIcon(log.newStatus, "w-2.5 h-2.5")}
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-0.5">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
                      Order marked as {log.newStatus}
                    </h3>
                    <time className="text-[10px] text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </time>
                  </div>
                  {log.note && (
                    <p className="text-xs text-gray-500">
                      {log.note}
                    </p>
                  )}
                </div>
              ))}
              
              {/* Initial Order Placed */}
              <div className="relative pl-5">
                <span className="absolute -left-2.5 flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 ring-2 ring-white text-gray-500">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-0.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
                    Order Placed
                  </h3>
                  <time className="text-[10px] text-gray-400">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                  </time>
                </div>
                <p className="text-xs text-gray-500">
                  Customer successfully placed the order.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Customer, Shipping, Payment */}
        <div className="space-y-3 sm:space-y-4">
          {/* Customer & Delivery Information Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3 gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-main" />
                কাস্টমার ও ডেলিভারি ঠিকানা
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCustomerInfo}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold rounded-lg border border-sky-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                  title="কাস্টমারের নাম, ফোন, ঠিকানা ও সকল তথ্য একসাথে কপি করুন"
                >
                  {copiedCustomerInfo ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">কপি সম্পন্ন!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-sky-600" />
                      <span>কপি করুন</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] font-bold bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full border border-sky-200 hidden sm:inline-block">
                  যাচাইকৃত ঠিকানা
                </span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm">
              {/* Customer Name */}
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  নাম (Customer Name):
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-900 text-right">{resolved.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopySingleField(resolved.name, 'কাস্টমারের নাম', e)}
                    title="নাম কপি করুন"
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    {copiedField === 'কাস্টমারের নাম' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Customer Mobile */}
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  মোবাইল নম্বর (Mobile):
                </span>
                <div className="flex items-center gap-1.5">
                  <a href={`tel:${resolved.mobile}`} className="font-bold text-sky-700 hover:underline text-right font-mono">
                    {resolved.mobile}
                  </a>
                  <button
                    type="button"
                    onClick={(e) => handleCopySingleField(resolved.mobile, 'মোবাইল নম্বর', e)}
                    title="মোবাইল নম্বর কপি করুন"
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    {copiedField === 'মোবাইল নম্বর' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Customer Alternative Mobile */}
              {resolved.altPhone ? (
                <div className="flex items-start justify-between py-1 border-b border-slate-100">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    অতিরিক্ত নাম্বার (Alt Mobile):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <a href={`tel:${resolved.altPhone}`} className="font-semibold text-gray-800 hover:underline text-right font-mono">
                      {resolved.altPhone}
                    </a>
                    <button
                      type="button"
                      onClick={(e) => handleCopySingleField(resolved.altPhone, 'বিকল্প মোবাইল', e)}
                      title="বিকল্প মোবাইল কপি করুন"
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      {copiedField === 'বিকল্প মোবাইল' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* District */}
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  জেলা (District):
                </span>
                <span className="font-bold text-gray-900 bg-slate-100 px-2 py-0.5 rounded text-right">
                  {resolved.district || 'নির্বাচন করা হয়নি'}
                </span>
              </div>

              {/* Thana / Upazila */}
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-gray-400" />
                  থানা / উপজেলা (Thana):
                </span>
                <span className="font-bold text-gray-900 bg-slate-100 px-2 py-0.5 rounded text-right">
                  {resolved.upazila || 'নির্বাচন করা হয়নি'}
                </span>
              </div>

              {/* Area */}
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-gray-400" />
                  এলাকা (Area):
                </span>
                <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-right">
                  {resolved.area || 'নির্দিষ্ট এলাকা উল্লেখ নেই'}
                </span>
              </div>

              {/* Detailed Full Address */}
              <div className="py-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500 font-medium">
                    সম্পূর্ণ বিস্তারিত ঠিকানা:
                  </span>
                  {resolved.fullAddress && (
                    <button
                      type="button"
                      onClick={(e) => handleCopySingleField(resolved.fullAddress, 'সম্পূর্ণ ঠিকানা', e)}
                      className="text-[11px] text-sky-700 hover:text-sky-900 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      {copiedField === 'সম্পূর্ণ ঠিকানা' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      ঠিকানা কপি
                    </button>
                  )}
                </div>
                <p className="text-gray-800 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed text-xs sm:text-sm">
                  {resolved.fullAddress || 'ঠিকানা পাওয়া যায়নি'}
                </p>
              </div>

              {/* Additional Address / Notes */}
              {resolved.additionalNotes ? (
                <div className="py-1">
                  <span className="text-amber-800 block mb-1 font-medium flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    অতিরিক্ত নাম্বার/ঠিকানা / বিশেষ নির্দেশনা:
                  </span>
                  <p className="text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed text-xs">
                    {resolved.additionalNotes}
                  </p>
                </div>
              ) : null}

            </div>
          </div>

          {/* 2. Courier Information Card (Dedicated Section) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3 gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary-main" />
                Courier Information
              </h2>
              {/* Approval/Verification Badge */}
              {order.courierVerificationStatus === 'Verified' || order.courierAdminApproved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Approved / Verified
                </span>
              ) : order.courierVerificationStatus === 'Pending — Admin Review' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  Pending Admin Review
                </span>
              ) : order.courierVerificationStatus === 'Rejected' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Rejected by Admin
                </span>
              ) : (
                <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  Not Assigned
                </span>
              )}
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm">
              {/* Courier Name */}
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-gray-500">Courier Name:</span>
                <span className="font-bold text-gray-900">{order.courierName || 'N/A'}</span>
              </div>

              {/* Tracking ID */}
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-gray-500">Tracking ID:</span>
                {order.trackingNumber || order.trackingId ? (
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {order.trackingNumber || order.trackingId}
                    </code>
                    <button
                      type="button"
                      onClick={(e) => handleCopySingleField(order.trackingNumber || order.trackingId, 'ট্র্যাকিং আইডি', e)}
                      title="ট্র্যাকিং আইডি কপি করুন"
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      {copiedField === 'ট্র্যাকিং আইডি' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </div>

              {/* Admin Approval / Verification Status Detail */}
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-gray-500">Approval Status:</span>
                <span className="font-semibold text-gray-900">
                  {order.courierVerificationStatus === 'Verified' || order.courierAdminApproved ? 'Verified & Approved' :
                   order.courierVerificationStatus === 'Pending — Admin Review' ? 'In Admin Review' :
                   order.courierVerificationStatus === 'Rejected' ? 'Rejected' : 'Not Submitted'}
                </span>
              </div>

              {/* Rejection Reason if any */}
              {order.courierVerificationStatus === 'Rejected' && order.courierRejectedReason && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                  <span className="font-bold block mb-0.5">বাতিলের কারণ:</span>
                  <p>{order.courierRejectedReason}</p>
                </div>
              )}

              {/* Approved Tracking Link Button */}
              {order.trackingUrl && (
                <div className="pt-1">
                  <a
                    href={order.trackingUrl.startsWith('http') ? order.trackingUrl : `https://${order.trackingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <span>কুরিয়ার ওয়েবসাইটে ট্র্যাক করুন</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Courier Action Button */}
              <div className="pt-1">
                {isResellerOrder && !isResellerConfirmed ? (
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs space-y-2.5">
                    <div className="flex items-start gap-2 text-amber-950">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          কুরিয়ার ট্র্যাকিং লিংক লক রয়েছে
                        </span>
                        <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                          {resellerEligibility && !resellerEligibility.isBalanceSufficient ? (
                            <span>
                              রিসেলার প্রফিট রিজার্ভ করার মতো পর্যাপ্ত ওয়ালেট ব্যালেন্স নেই। ট্র্যাকিং লিংক দেওয়ার পূর্বে অবশ্যই ডিপোজিট করে "অর্ডার কনফার্ম করুন" সম্পন্ন করতে হবে।
                            </span>
                          ) : (
                            <span>
                              রিসেলার প্রফিট লক করতে প্রথমে "অর্ডার কনফার্ম করুন" সম্পন্ন করুন। কনফার্মেশনের পরই কুরিয়ার ট্র্যাকিং লিংক যুক্ত করা যাবে।
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={handleConfirmResellerOrder}
                        disabled={isConfirmingResellerOrder}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        {isConfirmingResellerOrder ? (
                          <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>অর্ডার কনফার্ম করুন</span>
                      </button>

                      {resellerEligibility && !resellerEligibility.isBalanceSufficient && (
                        <button
                          type="button"
                          onClick={handleOpenDepositFlow}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer animate-pulse"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Deposit করুন (ঘাটতি ৳{resellerEligibility.shortfall})</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : order.courierVerificationStatus === 'Pending — Admin Review' ? (
                  <div className="w-full py-2 bg-amber-50 border border-amber-300 text-amber-900 text-center font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>লিংক লক করা (অ্যাডমিন রিভিউ চলছে)</span>
                  </div>
                ) : order.courierVerificationStatus === 'Rejected' ? (
                  <button
                    type="button"
                    onClick={() => setShowCourierModal(true)}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>🔄 নতুন সঠিক কুরিয়ার লিংক দিন</span>
                  </button>
                ) : (order.courierVerificationStatus === 'Verified' || order.courierAdminApproved) ? (
                  <div className="w-full py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-center font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>কুরিয়ার ট্র্যাকিং লিংক অনুমোদিত</span>
                  </div>
                ) : !['Cancelled', 'Refunded'].includes(order.status) ? (
                  <button
                    type="button"
                    onClick={() => setShowCourierModal(true)}
                    className="w-full py-2.5 bg-primary-main hover:bg-sky-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>{order.trackingUrl ? 'কুরিয়ার লিংক আপডেট করুন' : 'কুরিয়ার ট্র্যাকিং লিংক দিন'}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Payment Breakdown & COD Calculation Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                পেমেন্ট ও ক্যাশ অন ডেলিভারি (COD)
              </h2>
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                isCodOrder(order)
                  ? (order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800')
                  : order.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 
                    order.paymentStatus === 'Failed' ? 'bg-red-100 text-red-800' : 
                    'bg-amber-100 text-amber-800'
              }`}>
                {isCodOrder(order) 
                  ? (order.status === 'Delivered' ? 'COD Collected' : 'Cash on Delivery') 
                  : (order.paymentStatus || 'Pending')}
              </span>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-gray-500">পেমেন্ট মেথড (Payment Method)</span>
                <span className="font-bold text-gray-900 uppercase">
                  {isCodOrder(order) ? 'CASH ON DELIVERY (COD)' :
                   order.paymentMethod === 'product_full_payment' ? 'Full Advance Payment' :
                   order.paymentMethod === 'only_delivery_charge' ? 'Delivery Charge Advance' :
                   order.paymentMethod === 'wallet' ? 'RJ Wallet' :
                   order.paymentMethod || 'Cash on Delivery (COD)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-gray-500">পণ্য মূল্য (Items Price):</span>
                <span className="font-semibold text-gray-900">৳{resolved.itemsPrice.toLocaleString('bn-BD')}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-gray-500">ডেলিভারি চার্জ (Delivery Charge):</span>
                <span className="font-semibold text-gray-900">৳{resolved.deliveryCharge.toLocaleString('bn-BD')}</span>
              </div>

              {(order.packageBreakdown?.routeLabelBn || order.shippingSnapshot?.vendorPackages?.[0]?.routeLabelBn || order.vendorLocation?.district) && (
                <div className="text-[11px] text-sky-800 bg-sky-50/80 border border-sky-100 px-2.5 py-1 rounded-md flex justify-between items-center">
                  <span>রুট: {order.packageBreakdown?.routeLabelBn || order.shippingSnapshot?.vendorPackages?.[0]?.routeLabelBn || 'কুরিয়ার ডেলিভারি'}</span>
                  <span>{order.vendorLocation?.district || order.packageBreakdown?.vendorLocation?.district || 'ভেন্ডর'} হতে</span>
                </div>
              )}

              <div className="flex justify-between items-center py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-gray-900">পণ্য মূল্য + ডেলিভারি চার্জ:</span>
                <span className="font-bold text-primary-main text-sm">৳{resolved.grandTotal.toLocaleString('bn-BD')}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 px-2 bg-sky-50 rounded-lg border border-sky-100">
                <span className="font-bold text-sky-900 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  Online/Advance Payment:
                </span>
                <span className={`font-bold ${resolved.isFullPayment ? 'text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded' : 'text-sky-800'}`}>
                  ৳{resolved.advanceAmount.toLocaleString('bn-BD')} {resolved.isFullPayment ? '(Full Payment)' : ''}
                </span>
              </div>

              {/* COD collection block */}
              <div className={`p-3 rounded-xl border ${
                resolved.codAmount === 0 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm">
                    Cash on Delivery (Payable Amount):
                  </span>
                  <span className="font-extrabold text-base sm:text-lg">
                    {resolved.codAmount === 0 ? '০ টাকা' : `৳${resolved.codAmount.toLocaleString('bn-BD')}`}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1">
                  {resolved.codAmount === 0 
                    ? 'কাস্টমার সম্পূর্ণ মূল্য অনলাইন পেমেন্টে পরিশোধ করেছেন।' 
                    : 'কুরিয়ার ডেলিভারির সময় কাস্টমার থেকে এই টাকা সংগ্রহ করবে।'}
                </p>
              </div>

              {/* Vendor Payout / Payment Section */}
              {isCodOrder(order) ? (
                /* CASH ON DELIVERY (COD): No Wallet Credit, No Payment Held */
                <div className="pt-2.5 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">পেমেন্ট মেথড:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      Cash on Delivery (COD)
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-gray-700">
                    <span>COD Amount (Payable):</span>
                    <span className="font-bold text-gray-900 text-sm">
                      ৳{resolved.codAmount.toLocaleString('bn-BD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-gray-700">
                    <span>ওয়ালেট ক্রেডিট:</span>
                    <span className="font-bold text-gray-500 text-sm">৳০</span>
                  </div>

                  {order.status === 'Delivered' && (
                    <div className="flex justify-between items-center text-gray-700 pt-1 border-t border-slate-100">
                      <span className="text-slate-600 font-medium text-xs">ভেন্ডর প্ল্যাটফর্ম ফি:</span>
                      <span className="font-bold text-amber-700 text-xs px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md">
                        ৳{order.platformFee || 5} (রেকর্ডকৃত)
                      </span>
                    </div>
                  )}

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    ক্যাশ অন ডেলিভারি (COD) অর্ডারের টাকা কোনোভাবেই ওয়ালেটে জমা বা হোল্ড হবে না। কুরিয়ার ডেলিভারির সময় কাস্টমার থেকে সরাসরি মূল্য সংগ্রহ করবে।
                  </div>
                </div>
              ) : (
                /* SUCCESSFUL ONLINE PAYMENT: Payment Held with 4-Day Auto-Release */
                <div className="pt-2.5 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">ভেন্ডর পে-আউট স্ট্যাটাস:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      order.vendorPayoutStatus === 'Released' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      order.vendorPayoutStatus === 'Disputed' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      order.vendorPayoutStatus === 'Refunded' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                      'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {order.vendorPayoutStatus === 'Released' ? 'Released to Wallet' :
                       order.vendorPayoutStatus === 'Disputed' ? 'Held (Disputed)' :
                       order.vendorPayoutStatus === 'Refunded' ? 'Refunded' :
                       'Payment Held'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-gray-700">
                    <span>Payment Held (পরিশোধিত মূল্য):</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      ৳{(resolved.advanceAmount || 0).toLocaleString('bn-BD')}
                    </span>
                  </div>

                  {/* State explanations */}
                  {order.vendorPayoutStatus === 'Disputed' || order.status === 'Dispute' ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="font-bold flex items-center gap-1.5 text-rose-900">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          Dispute Reported by Customer
                        </div>
                        <span className="px-2 py-0.5 bg-rose-200 text-rose-800 rounded text-[10px] font-bold">
                          Payment On Hold
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-rose-100 space-y-1">
                        <p><strong>Reason:</strong> {order.dispute?.reason || 'Customer reported issue'}</p>
                        {order.dispute?.details && <p><strong>Details:</strong> {order.dispute?.details}</p>}
                        <p className="text-[11px] text-rose-700">
                          Vendor payout is on HOLD while Admin investigates. You can submit your statement/response below.
                        </p>
                      </div>

                      {/* Customer Evidence Photos */}
                      {order.dispute?.images?.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-bold text-slate-700 text-[11px]">Customer Proof Photos ({order.dispute.images.length}):</span>
                          <div className="flex flex-wrap gap-1.5">
                            {order.dispute.images.map((img: string, idx: number) => (
                              <a key={idx} href={img} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-primary-main">
                                <img referrerPolicy="no-referrer" src={img} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Existing Vendor Response */}
                      {order.dispute?.vendorResponse ? (
                        <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg space-y-1">
                          <div className="flex justify-between items-center text-teal-900 font-bold text-[11px]">
                            <span>Your Submitted Response:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setVendorReplyText(order.dispute?.vendorResponse?.text || '');
                                setShowReplyForm(!showReplyForm);
                              }}
                              className="text-primary-main hover:underline text-[10px]"
                            >
                              {showReplyForm ? 'Close Edit' : 'Edit Reply'}
                            </button>
                          </div>
                          <p className="text-slate-800 text-xs bg-white p-2 rounded border border-teal-100">
                            "{order.dispute.vendorResponse.text}"
                          </p>
                        </div>
                      ) : null}

                      {/* Vendor Response Form */}
                      {(!order.dispute?.vendorResponse || showReplyForm) && (
                        <div className="pt-2 border-t border-rose-200 space-y-2">
                          <label className="block text-[11px] font-bold text-slate-700">
                            {order.dispute?.vendorResponse ? 'Update Your Response to Admin:' : 'Submit Your Response / Explanation:'}
                          </label>
                          <textarea
                            rows={2}
                            value={vendorReplyText}
                            onChange={(e) => setVendorReplyText(e.target.value)}
                            placeholder="Explain what happened with this order or package..."
                            className="w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-800 focus:outline-none resize-none"
                          />
                          <button
                            type="button"
                            disabled={submittingReply || !vendorReplyText.trim()}
                            onClick={async () => {
                              if (!vendorReplyText.trim()) return;
                              setSubmittingReply(true);
                              try {
                                const res = await vendorReplyDispute(
                                  order.mainOrderId || order.id,
                                  user?.uid || '',
                                  (user as any)?.displayName || 'Vendor',
                                  vendorReplyText.trim()
                                );
                                if (res.success) {
                                  toast.success(res.message);
                                  setShowReplyForm(false);
                                  fetchOrderDetails();
                                } else {
                                  toast.error(res.message);
                                }
                              } finally {
                                setSubmittingReply(false);
                              }
                            }}
                            className="w-full py-1.5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {submittingReply ? <RefreshCcw className="w-3 h-3 animate-spin" /> : null}
                            <span>Submit Statement to Admin</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : order.vendorPayoutStatus === 'Released' ? (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>অনলাইন পেমেন্টের টাকা ভেন্ডর ওয়ালেটে Release করা হয়েছে (Available Balance-এ জমা হয়েছে)।</span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Payment Held (৪ দিনের সিকিউরিটি উইন্ডো)</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        সফল অনলাইন পেমেন্টের টাকা ৪ দিন (৯৬ ঘণ্টা) পর্যন্ত Held থাকবে। ৪ দিন পূর্ণ হলে Held Amount স্বয়ংক্রিয়ভাবে ভেন্ডর ওয়ালেটের Available Balance-এ Release হবে।
                      </p>
                      {order.autoReleaseAt && Date.now() >= order.autoReleaseAt && (
                        <button
                          onClick={async () => {
                            setReleasingPayout(true);
                            try {
                              const res = await checkAndAutoReleaseVendorPayout(order);
                              if (res.released) {
                                toast.success(res.message);
                                fetchOrderDetails();
                              } else {
                                toast(res.message);
                              }
                            } finally {
                              setReleasingPayout(false);
                            }
                          }}
                          disabled={releasingPayout}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-sm"
                        >
                          {releasingPayout ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          ৪ দিন পূর্ণ হয়েছে — Release to Wallet Now
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {order.transactionId && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-gray-500">Transaction ID</span>
                  <span className="text-xs font-mono text-gray-900">{order.transactionId}</span>
                </div>
              )}
              {!isCodOrder(order) && order.paymentStatus !== 'Paid' && (
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <button 
                    onClick={handleConfirmPayment}
                    className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs sm:text-sm font-medium rounded-lg transition-colors"
                  >
                    Confirm Payment Received
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Update Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-900">Update Order Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateStatus} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">New Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {validNextStatuses().map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setNewStatus(status)}
                      className={`flex items-center gap-1.5 p-2 text-xs font-medium rounded-xl border text-left transition-colors ${
                        newStatus === status 
                          ? 'border-primary-main bg-primary-main/5 text-primary-main' 
                          : 'border-gray-200 text-gray-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        newStatus === status ? 'border-primary-main' : 'border-gray-300'
                      }`}>
                        {newStatus === status && <div className="w-1.5 h-1.5 bg-primary-main rounded-full" />}
                      </div>
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {['Accepted', 'Shipped', 'In Transit', 'Out for Delivery'].includes(newStatus) && (
                <div className="space-y-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Courier Name {newStatus === 'Shipped' ? '*' : '(Optional)'}</label>
                    <input
                      type="text"
                      required={newStatus === 'Shipped'}
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="e.g. Steadfast, RedX, Pathao, Sundarban..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tracking Number {newStatus === 'Shipped' ? '*' : '(Optional)'}</label>
                    <input
                      type="text"
                      required={newStatus === 'Shipped'}
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. SF-84920194"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main font-mono text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tracking URL (Optional)</label>
                    <input
                      type="url"
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://steadfast.com.bd/t/..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Internal Note (Optional)</label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Add a note to this status update..."
                  rows={2}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 font-medium text-xs rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newStatus || updating}
                  className="flex-1 px-3 py-1.5 bg-primary-main text-white font-medium text-xs rounded-lg hover:bg-primary-main/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {updating && <RefreshCcw className="w-3.5 h-3.5 animate-spin" />}
                  {updating ? 'Updating...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Anti-Scam Courier Verification Modal */}
      {showCourierModal && order && (!isResellerOrder || isResellerConfirmed) && (
        <CourierVerificationModal
          order={order}
          isOpen={showCourierModal}
          onClose={() => setShowCourierModal(false)}
          onSuccess={() => {
            setShowCourierModal(false);
            fetchOrderDetails();
          }}
        />
      )}

      {/* Vendor Cancel Order Modal (with Notice & Refund Flow) */}
      {showCancelModal && order && (
        <VendorCancelOrderModal
          order={order}
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          vendorId={user?.uid || ''}
          onSuccess={() => {
            setShowCancelModal(false);
            fetchOrderDetails();
          }}
        />
      )}

      {/* Reseller Order Balance Deposit Flow - Payment Selection Modal */}
      <PaymentMethodSelectionModal
        isOpen={showPaymentSelectionModal}
        onClose={() => setShowPaymentSelectionModal(false)}
        onConfirmPayment={handleConfirmPaymentChannel}
        amount={depositAmount}
        paymentType="vendor_wallet_deposit"
        invoiceId={currentInvoiceId}
        selectedChannel={selectedPaymentChannel}
        onSelectChannel={setSelectedPaymentChannel}
      />

      {/* bkash Payment Modal */}
      <BkashPaymentModal
        isOpen={showBkashModal}
        onClose={() => setShowBkashModal(false)}
        onBack={() => {
          setShowBkashModal(false);
          setShowPaymentSelectionModal(true);
        }}
        amount={depositAmount}
        invoiceId={currentInvoiceId}
        isSubmitting={isVerifyingPayment}
        errorMessage={paymentErrorMessage}
        onVerify={(trxId) => handleVerifyDepositPayment('bkash', trxId)}
      />

      {/* nagad Payment Modal */}
      <NagadPaymentModal
        isOpen={showNagadModal}
        onClose={() => setShowNagadModal(false)}
        onBack={() => {
          setShowNagadModal(false);
          setShowPaymentSelectionModal(true);
        }}
        amount={depositAmount}
        invoiceId={currentInvoiceId}
        isSubmitting={isVerifyingPayment}
        errorMessage={paymentErrorMessage}
        onVerify={(trxId) => handleVerifyDepositPayment('nagad', trxId)}
      />

      {/* rocket Payment Modal */}
      <RocketPaymentModal
        isOpen={showRocketModal}
        onClose={() => setShowRocketModal(false)}
        onBack={() => {
          setShowRocketModal(false);
          setShowPaymentSelectionModal(true);
        }}
        amount={depositAmount}
        invoiceId={currentInvoiceId}
        isSubmitting={isVerifyingPayment}
        errorMessage={paymentErrorMessage}
        onVerify={(trxId) => handleVerifyDepositPayment('rocket', trxId)}
      />

      {/* upay Payment Modal */}
      <UpayPaymentModal
        isOpen={showUpayModal}
        onClose={() => setShowUpayModal(false)}
        onBack={() => {
          setShowUpayModal(false);
          setShowPaymentSelectionModal(true);
        }}
        amount={depositAmount}
        invoiceId={currentInvoiceId}
        isSubmitting={isVerifyingPayment}
        errorMessage={paymentErrorMessage}
        onVerify={(trxId) => handleVerifyDepositPayment('upay', trxId)}
      />

      {/* Step 8: Vendor Report Return / Failed Delivery Modal */}
      <VendorReportReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onSubmit={handleVendorReportReturn}
        orderId={order?.orderId || order?.id || id || ''}
        resellerProfit={Number(order?.lockedProfitAmount ?? order?.resellerProfit ?? 0)}
        loading={isReportingReturn}
      />

      {/* Payment Success Modal */}
      <PaymentSuccessModal
        isOpen={showPaymentSuccessModal}
        title="ডিপোজিট সফল হয়েছে! 🎉"
        subtitle="Wallet Balance Updated"
        targetName="অর্ডার বিবরণ"
        onComplete={() => {
          setShowPaymentSuccessModal(false);
          refreshWalletAndOrder();
        }}
      />

      {/* Print Styles */}
      <style>{`
        @media print {
          aside, nav, header, footer, .print\\:hidden {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 12pt;
          }
          .shadow-sm, .shadow-md, .shadow-xl {
            box-shadow: none !important;
          }
          .border {
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>
    </VendorLayout>
  );
}
