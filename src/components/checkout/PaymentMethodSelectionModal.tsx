import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, X, Headphones, ArrowLeftRight, Info, Smartphone, CheckCircle2, Check, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import LiveSupportChatBox from '../support/LiveSupportChatBox';

export interface PaymentMethodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (channel: 'bkash' | 'nagad' | 'rocket' | 'upay') => void;
  amount: number;
  paymentType?: 'product_full_payment' | 'only_delivery_charge' | 'vendor_registration_fee' | 'reseller_registration_fee' | 'registration_fee' | string;
  invoiceId?: string;
  isSubmitting?: boolean;
  selectedChannel?: 'bkash' | 'nagad' | 'rocket' | 'upay' | null;
  onSelectChannel?: (channel: 'bkash' | 'nagad' | 'rocket' | 'upay' | null) => void;
}

export default function PaymentMethodSelectionModal({
  isOpen,
  onClose,
  onConfirmPayment,
  amount,
  paymentType,
  invoiceId = 'S2N4HE603308',
  isSubmitting = false,
  selectedChannel: controlledChannel,
  onSelectChannel
}: PaymentMethodSelectionModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'help' | 'payment' | 'info'>('payment');
  const [internalSelectedChannel, setInternalSelectedChannel] = useState<'bkash' | 'nagad' | 'rocket' | 'upay' | null>(null);
  const [showLiveChatModal, setShowLiveChatModal] = useState(false);

  const selectedChannel = controlledChannel !== undefined ? controlledChannel : internalSelectedChannel;
  const handleSelect = (channel: 'bkash' | 'nagad' | 'rocket' | 'upay') => {
    if (onSelectChannel) {
      onSelectChannel(channel);
    }
    setInternalSelectedChannel(channel);
  };
  const setSelectedChannel = handleSelect;

  if (!isOpen) return null;

  const handlePay = () => {
    if (!selectedChannel) {
      if (activeTab !== 'payment') {
        setActiveTab('payment');
      }
      toast.error('অনুগ্রহ করে একটি পেমেন্ট পদ্ধতি নির্বাচন করুন (Bkash, Nagad, Rocket অথবা Upay)');
      return;
    }
    onConfirmPayment(selectedChannel);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[440px] max-h-[94vh] flex flex-col justify-between bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl border border-gray-100 my-auto relative animate-in zoom-in-95 duration-200 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="w-full border border-gray-200 rounded-xl sm:rounded-2xl px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between bg-white shadow-2xs mb-3 sm:mb-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-lg text-gray-700 transition-colors touch-manipulation cursor-pointer"
            title="হোম পেজে যান"
          >
            <Home className="w-5 h-5 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-lg text-gray-700 transition-colors touch-manipulation cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Brand Logo & Name */}
        <div className="flex flex-col items-center justify-center mb-3 sm:mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden flex items-center justify-center p-1 bg-white shadow-xs border border-gray-100 mb-1.5 sm:mb-2">
            <img
              referrerPolicy="no-referrer"
              src="https://i.postimg.cc/02BC9ZMs/file-00000000c36881fa822edc96c75d817a.png"
              alt="RJ WORLD BD Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <h2 className="text-base sm:text-xl font-black text-gray-900 tracking-wider">
            RJ WORLD BD
          </h2>
        </div>

        {/* 3 Action Buttons */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('help')}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-2xs touch-manipulation cursor-pointer ${
              activeTab === 'help'
                ? 'border-2 border-blue-500 bg-blue-50/70 text-blue-600 shadow-sm'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 active:bg-gray-100'
            }`}
            title="সাপোর্ট সেন্টার"
          >
            <Headphones className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-2xs touch-manipulation cursor-pointer ${
              activeTab === 'payment'
                ? 'border-2 border-blue-500 bg-blue-50/70 text-blue-600 shadow-sm'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 active:bg-gray-100'
            }`}
            title="পেমেন্ট পদ্ধতি"
          >
            <ArrowLeftRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-2xs touch-manipulation cursor-pointer ${
              activeTab === 'info'
                ? 'border-2 border-blue-500 bg-blue-50/70 text-blue-600 shadow-sm'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 active:bg-gray-100'
            }`}
            title="সাধারণ তথ্য"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* TAB 1: HELP CENTER (সাপোর্ট সেন্টার) */}
        {activeTab === 'help' && (
          <div className="w-full flex flex-col justify-center animate-in fade-in-50 duration-200">
            {/* Dark Banner */}
            <div className="w-full bg-[#182230] text-white py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-center text-sm sm:text-[15px] shadow-sm mb-3 sm:mb-4 tracking-wide select-none">
              সাপোর্ট সেন্টার
            </div>

            {/* 3 Contact Option Cards */}
            <div className="space-y-3 sm:space-y-3.5 mb-4 sm:mb-5">
              {/* Option 1: Call Support */}
              <a
                href="tel:+8809638969026"
                className="w-full border border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center gap-3 sm:gap-3.5 bg-white hover:border-blue-300 hover:bg-blue-50/30 active:scale-[0.99] transition-all shadow-2xs text-left cursor-pointer no-underline block"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-9 sm:h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 7.5C11.5 7.5 10.5 8 9.8 8.7L8.2 10.3C7.5 11 7 12 7 13.2C7 19.5 16.5 29 22.8 29C24 29 25 28.5 25.7 27.8L27.3 26.2C28.7 24.8 28.7 22.6 27.3 21.2L24.8 18.7C23.4 17.3 21.2 17.3 19.8 18.7L18.8 19.7C16.8 18.5 15.2 16.9 14 14.9L15 13.9C16.4 12.5 16.4 10.3 15 8.9L12.5 7.5Z" fill="#0084ff"/>
                    <path d="M21 9C23 10 25 12 26 14" stroke="#00b0ff" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 1"/>
                    <path d="M24 6C27 7.5 29.5 10 31 13" stroke="#00d2ff" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-[15px] font-bold text-gray-800">
                    Call Support: <span className="font-extrabold text-gray-900">+8809638969026</span>
                  </p>
                </div>
              </a>

              {/* Option 2: Customer Live Support System (কাষ্টমার লাইভ সাপোর্ট সিস্টেম) */}
              <button
                type="button"
                onClick={() => setShowLiveChatModal(true)}
                className="w-full border border-gray-200 hover:border-blue-300 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center gap-3 sm:gap-3.5 bg-white hover:bg-blue-50/30 active:scale-[0.99] transition-all shadow-2xs text-left cursor-pointer group block"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 relative bg-blue-50 text-blue-600 border border-blue-100/80 group-hover:bg-blue-100 transition-colors">
                  <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-9 sm:h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="18" r="16" fill="#0084FF"/>
                    <path d="M18 9C12.5 9 8 13 8 18C8 20.8 9.2 23.3 11.2 25L10.5 28.5L14.2 27.2C15.4 27.7 16.7 28 18 28C23.5 28 28 24 28 18C28 13 23.5 9 18 9Z" fill="white"/>
                    <circle cx="13.5" cy="18" r="1.5" fill="#0084FF"/>
                    <circle cx="18" cy="18" r="1.5" fill="#0084FF"/>
                    <circle cx="22.5" cy="18" r="1.5" fill="#0084FF"/>
                  </svg>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                </div>
                <div className="min-w-0 flex-1 flex flex-wrap items-center justify-between gap-1.5">
                  <div>
                    <span className="text-sm sm:text-[15px] font-bold text-gray-800 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                      কাষ্টমার লাইভ সাপোর্ট
                    </span>
                    <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight mt-0.5">
                      পেমেন্ট ও অর্ডার সহায়তায় সরাসরি কথা বলুন
                    </p>
                  </div>
                  <span className="font-extrabold text-blue-700 bg-blue-50 group-hover:bg-blue-100 px-2.5 py-1 rounded-lg text-xs sm:text-sm border border-blue-200/80 flex items-center gap-1.5 tracking-wide transition-colors">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    লাইভ চ্যাট
                  </span>
                </div>
              </button>

              {/* Option 3: Email Support */}
              <a
                href="mailto:support.rjworld@gmail.com"
                className="w-full border border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center gap-3 sm:gap-3.5 bg-white hover:border-amber-300 hover:bg-amber-50/30 active:scale-[0.99] transition-all shadow-2xs text-left cursor-pointer no-underline block"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-9 sm:h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="8" width="26" height="20" rx="3" fill="#f5a623"/>
                    <path d="M5 10L18 20L31 10" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="18" cy="20" r="4.5" fill="#f5a623" stroke="white" strokeWidth="1.2"/>
                    <text x="18" y="22.5" textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fontWeight="bold" fill="white">@</text>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600 leading-tight">
                    Email Support:
                  </p>
                  <p className="text-sm sm:text-[15px] font-extrabold text-gray-900 leading-tight mt-0.5 truncate">
                    support.rjworld@gmail.com
                  </p>
                </div>
              </a>
            </div>
          </div>
        )}

        {/* TAB 2: GENERAL INFORMATION (সাধারণ তথ্য) */}
        {activeTab === 'info' && (
          <div className="w-full flex flex-col justify-center animate-in fade-in-50 duration-200">
            {/* Dark Banner */}
            <div className="w-full bg-[#182230] text-white py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-center text-sm sm:text-[15px] shadow-sm mb-3 sm:mb-4 tracking-wide select-none">
              সাধারণ তথ্য
            </div>

            {/* Information Card */}
            <div className="w-full border border-gray-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-white shadow-2xs mb-4">
              {/* Row 1: Merchant */}
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500 font-medium text-sm sm:text-[15px]">Merchant</span>
                <span className="text-gray-900 font-bold text-sm sm:text-[15px]">RJ WORLD BD</span>
              </div>

              {/* Dashed divider */}
              <div className="border-b border-dashed border-gray-200 my-3 sm:my-3.5" />

              {/* Row 2: Trx ID */}
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500 font-medium text-sm sm:text-[15px]">Trx ID</span>
                <span className="text-gray-900 font-bold text-sm sm:text-[15px] tracking-wide">{invoiceId}</span>
              </div>

              {/* Dashed divider */}
              <div className="border-b border-dashed border-gray-200 my-3 sm:my-3.5" />

              {/* Row 3: Payable Amount */}
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500 font-medium text-sm sm:text-[15px]">Payable Amount</span>
                <span className="text-gray-900 font-extrabold text-base sm:text-lg">৳{amount.toFixed(2)}</span>
              </div>

              {/* Row 4: Purpose */}
              {paymentType && (
                <>
                  <div className="border-b border-dashed border-gray-200 my-3 sm:my-3.5" />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500 font-medium text-sm sm:text-[15px]">Payment For</span>
                    <span className="text-gray-900 font-bold text-sm sm:text-[15px]">
                      {paymentType === 'vendor_registration_fee'
                        ? 'Vendor Registration Fee'
                        : paymentType === 'reseller_registration_fee'
                        ? 'Reseller Registration Fee'
                        : paymentType === 'registration_fee'
                        ? 'Registration Fee'
                        : paymentType === 'only_delivery_charge'
                        ? 'Delivery Charge'
                        : 'Product Full Payment'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENT METHOD SELECTION (পেমেন্ট পদ্ধতি নির্বাচন করুন) */}
        {activeTab === 'payment' && (
          <div className="w-full flex flex-col justify-center animate-in fade-in-50 duration-200">
            {/* "পেমেন্ট পদ্ধতি নির্বাচন করুন" Dark Banner */}
            <div className="w-full bg-[#182230] text-white py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-center text-sm sm:text-[15px] shadow-sm mb-2.5 sm:mb-3 tracking-wide select-none">
              পেমেন্ট পদ্ধতি নির্বাচন করুন
            </div>

        {/* "Mobile Banking" Indicator */}
        <div className="w-full bg-white border border-blue-100 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 shadow-2xs mb-3 sm:mb-3.5 select-none">
          <Smartphone className="w-4 h-4 text-blue-600" />
          <span className="text-blue-600 font-bold text-xs sm:text-sm">Mobile Banking</span>
        </div>

        {/* 2x2 Payment Option Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 mb-3.5 sm:mb-4">
          {/* Card 1: Bkash Personal */}
          <button
            type="button"
            onClick={() => setSelectedChannel('bkash')}
            className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col items-center justify-center cursor-pointer transition-all select-none min-h-[90px] sm:min-h-[102px] touch-manipulation active:scale-[0.97] text-left w-full ${
              selectedChannel === 'bkash'
                ? 'border-2 border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-sm'
                : 'border border-gray-200 bg-white hover:border-gray-300 active:bg-gray-50/80 shadow-2xs'
            }`}
          >
            {/* Top Left Selection Check Badge */}
            {selectedChannel === 'bkash' ? (
              <span className="absolute top-2 left-2 bg-blue-600 text-white rounded-full p-0.5 shadow-2xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            ) : null}

            {/* Top Right LIVE Badge */}
            <span className="absolute top-2 right-2 bg-[#e23636] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider leading-none shadow-2xs pointer-events-none">
              LIVE
            </span>
            <div className="h-8 sm:h-9 flex items-center justify-center mt-1 pointer-events-none">
              <svg viewBox="0 0 110 36" className="h-6.5 sm:h-7.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* bKash text */}
                <path d="M10 24L10 8L15 8C18 8 19.5 9.5 19.5 12C19.5 13.5 18.8 14.5 17.5 15C19.2 15.6 20 17 20 19C20 22 18 24 14.5 24L10 24ZM13 15L14.5 15C16 15 16.8 14.3 16.8 13.2C16.8 12.1 16 11.5 14.5 11.5L13 11.5L13 15ZM13 21.2L14.8 21.2C16.5 21.2 17.3 20.3 17.3 19C17.3 17.7 16.5 16.8 14.8 16.8L13 16.8L13 21.2Z" fill="#e2136e"/>
                <path d="M22 24L22 8L25 8L25 17L30.5 8L34.5 8L28.5 17L35 24L31 24L26 18.2L25 19.5L25 24L22 24Z" fill="#e2136e"/>
                <path d="M39.5 24L39 22.2C38 23.6 36.8 24.2 35.5 24.2C33.2 24.2 32 22.8 32 20.5C32 17.8 34.2 16.8 39 16.8L39 16.2C39 15 38.2 14.2 36.8 14.2C35.5 14.2 34.5 14.7 33.8 15.2L33 13.2C34.2 12.4 35.8 12 37.2 12C40.2 12 41.8 13.5 41.8 16.5L41.8 24L39.5 24ZM39 18.8C36 18.8 34.5 19.3 34.5 20.8C34.5 21.9 35.2 22.5 36.3 22.5C38 22.5 39 21.3 39 19.8L39 18.8Z" fill="#e2136e"/>
                <path d="M47 15C46 14.2 45 13.8 44 13.8C42.8 13.8 42.2 14.4 42.2 15C42.2 15.9 43.2 16.4 45 17C47.8 18 49 19.2 49 21.2C49 23.2 47.2 24.2 44.5 24.2C42.8 24.2 41.2 23.6 40.2 22.8L41.2 20.8C42.2 21.6 43.5 22 44.5 22C45.8 22 46.5 21.5 46.5 20.8C46.5 19.9 45.5 19.3 43.5 18.5C41.2 17.6 40 16.5 40 14.8C40 13 41.5 12 43.8 12C45.2 12 46.6 12.6 47.5 13.2L47 15Z" fill="#e2136e"/>
                <path d="M51 24L51 8L53.8 8L53.8 14.2C54.8 13.2 55.8 12.6 57.2 12.6C59.6 12.6 61 14.4 61 17.2L61 24L58.2 24L58.2 17.5C58.2 15.8 57.3 14.8 56 14.8C54.5 14.8 53.8 16 53.8 17.8L53.8 24L51 24Z" fill="#e2136e"/>
                {/* Origami bird */}
                <path d="M72 8L86 16L78 24L72 8Z" fill="#e2136e"/>
                <path d="M78 24L92 25L86 16L78 24Z" fill="#d00b61"/>
                <path d="M72 8L78 24L68 32L72 8Z" fill="#b80852"/>
                <path d="M68 32L78 24L82 34L68 32Z" fill="#e2136e"/>
              </svg>
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-900 mt-1 sm:mt-1.5 text-center pointer-events-none">
              Bkash Personal
            </span>
          </button>

          {/* Card 2: Nagad Personal */}
          <button
            type="button"
            onClick={() => setSelectedChannel('nagad')}
            className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col items-center justify-center cursor-pointer transition-all select-none min-h-[90px] sm:min-h-[102px] touch-manipulation active:scale-[0.97] text-left w-full ${
              selectedChannel === 'nagad'
                ? 'border-2 border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-sm'
                : 'border border-gray-200 bg-white hover:border-gray-300 active:bg-gray-50/80 shadow-2xs'
            }`}
          >
            {/* Top Left Selection Check Badge */}
            {selectedChannel === 'nagad' ? (
              <span className="absolute top-2 left-2 bg-blue-600 text-white rounded-full p-0.5 shadow-2xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            ) : null}

            {/* Top Right LIVE Badge */}
            <span className="absolute top-2 right-2 bg-[#e23636] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider leading-none shadow-2xs pointer-events-none">
              LIVE
            </span>
            <div className="h-8 sm:h-9 flex items-center justify-center mt-1 pointer-events-none">
              <svg viewBox="0 0 100 36" className="h-6.5 sm:h-7.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Nagad circular swirl */}
                <circle cx="18" cy="18" r="13" fill="#f7941d" />
                <path d="M18 7C21 10 22 14 20 17C18 20 14 21 12 24C10 20 11 15 14 11C15.5 9 17 7.8 18 7Z" fill="#fff"/>
                <circle cx="19" cy="16" r="3.2" fill="#ee3124"/>
                {/* "নগদ" Bengali text */}
                <text x="36" y="24" fontFamily="sans-serif" fontWeight="900" fontSize="18" fill="#f7941d">নগদ</text>
              </svg>
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-900 mt-1 sm:mt-1.5 text-center pointer-events-none">
              Nagad Personal
            </span>
          </button>

          {/* Card 3: Rocket Personal */}
          <button
            type="button"
            onClick={() => setSelectedChannel('rocket')}
            className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col items-center justify-center cursor-pointer transition-all select-none min-h-[90px] sm:min-h-[102px] touch-manipulation active:scale-[0.97] text-left w-full ${
              selectedChannel === 'rocket'
                ? 'border-2 border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-sm'
                : 'border border-gray-200 bg-white hover:border-gray-300 active:bg-gray-50/80 shadow-2xs'
            }`}
          >
            {/* Top Left Selection Check Badge */}
            {selectedChannel === 'rocket' ? (
              <span className="absolute top-2 left-2 bg-blue-600 text-white rounded-full p-0.5 shadow-2xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            ) : null}

            {/* Top Right LIVE Badge */}
            <span className="absolute top-2 right-2 bg-[#e23636] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider leading-none shadow-2xs pointer-events-none">
              LIVE
            </span>
            <div className="h-8 sm:h-9 flex items-center justify-center mt-1 pointer-events-none">
              <svg viewBox="0 0 100 36" className="h-6.5 sm:h-7.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Rocket icon */}
                <path d="M10 26L20 8L26 20L10 26Z" fill="#8c3494"/>
                <path d="M20 8L30 13L26 20L20 8Z" fill="#aa42b4"/>
                <path d="M26 20L34 28L18 24L26 20Z" fill="#6d1e75"/>
                {/* "রকেট" Bengali text */}
                <text x="38" y="24" fontFamily="sans-serif" fontWeight="900" fontSize="17" fill="#8c3494">রকেট</text>
              </svg>
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-900 mt-1 sm:mt-1.5 text-center pointer-events-none">
              Rocket Personal
            </span>
          </button>

          {/* Card 4: Upay Personal */}
          <button
            type="button"
            onClick={() => setSelectedChannel('upay')}
            className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col items-center justify-center cursor-pointer transition-all select-none min-h-[90px] sm:min-h-[102px] touch-manipulation active:scale-[0.97] text-left w-full ${
              selectedChannel === 'upay'
                ? 'border-2 border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-sm'
                : 'border border-gray-200 bg-white hover:border-gray-300 active:bg-gray-50/80 shadow-2xs'
            }`}
          >
            {/* Top Left Selection Check Badge */}
            {selectedChannel === 'upay' ? (
              <span className="absolute top-2 left-2 bg-blue-600 text-white rounded-full p-0.5 shadow-2xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            ) : null}

            {/* Top Right LIVE Badge */}
            <span className="absolute top-2 right-2 bg-[#e23636] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider leading-none shadow-2xs pointer-events-none">
              LIVE
            </span>
            <div className="h-8 sm:h-9 flex items-center justify-center mt-1 pointer-events-none">
              <svg viewBox="0 0 100 36" className="h-6.5 sm:h-7.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Upay smile & dot */}
                <circle cx="20" cy="10" r="3.2" fill="#fdb913"/>
                <path d="M13 14C13 20 16 24 20 24C24 24 27 20 27 14" stroke="#0072bc" strokeWidth="3.5" strokeLinecap="round"/>
                {/* "উপায়" Bengali text */}
                <text x="34" y="24" fontFamily="sans-serif" fontWeight="900" fontSize="17" fill="#0072bc">উপায়</text>
              </svg>
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-900 mt-1 sm:mt-1.5 text-center pointer-events-none">
              Upay Personal
            </span>
          </button>
        </div>
      </div>
    )}

        {/* Secured by RJ WORLD BD Badge */}
        <div className="flex items-center justify-center gap-1.5 mb-3 sm:mb-4 text-gray-600 text-xs sm:text-sm font-medium select-none">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Secured by RJ WORLD BD</span>
        </div>

        {/* Pay Button */}
        <button
          type="button"
          onClick={handlePay}
          disabled={isSubmitting}
          className="w-full bg-[#0066ff] hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 sm:py-4 px-6 rounded-xl sm:rounded-2xl text-base sm:text-lg shadow-md transition-all active:scale-[0.98] flex items-center justify-center select-none touch-manipulation cursor-pointer min-h-[50px] sm:min-h-[54px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">Processing...</span>
          ) : (
            `Pay ৳${amount.toFixed(2)}`
          )}
        </button>
      </div>

      {/* Customer Live Support System Modal */}
      {showLiveChatModal && (
        <div 
          className="fixed inset-0 z-70 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setShowLiveChatModal(false)}
        >
          <div 
            className="w-full max-w-[560px] max-h-[94vh] flex flex-col bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 my-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <LiveSupportChatBox
              initialRole={
                paymentType === 'reseller_registration_fee' ? 'reseller' :
                paymentType === 'vendor_registration_fee' ? 'vendor' :
                'customer'
              }
              title="কাষ্টমার লাইভ সাপোর্ট"
              subtitle="পেমেন্ট ও সার্ভিস সংক্রান্ত তাৎক্ষণিক সহায়তা"
              className="h-[560px] sm:h-[620px] max-h-[85vh] border-0 rounded-none shadow-none"
              onClose={() => setShowLiveChatModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
