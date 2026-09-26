import React, { useState } from 'react';
import { Ticket, Copy, Check, Clock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export interface StoreVoucher {
  id: string;
  code: string;
  title: string;
  discountText: string;
  minSpendText?: string;
  validUntil?: string;
}

interface StoreVouchersProps {
  vouchers?: StoreVoucher[];
  primaryColor?: string;
}

const DEFAULT_VOUCHERS: StoreVoucher[] = [
  {
    id: 'v-1',
    code: 'STORE50',
    title: 'স্পেশাল স্টোর ডিসকাউন্ট',
    discountText: '৳৫০ ছাড়',
    minSpendText: 'সর্বনিম্ন ৳৫০০ অর্ডারে প্রযোজ্য',
    validUntil: 'এই মাসের শেষ পর্যন্ত'
  },
  {
    id: 'v-2',
    code: 'FREESHIP',
    title: 'ফ্রি ডেলিভারি অফার',
    discountText: 'ফ্রি শিপিং',
    minSpendText: 'সর্বনিম্ন ৳১,৫০০ অর্ডারে প্রযোজ্য',
    validUntil: 'সীমিত সময়ের জন্য'
  },
  {
    id: 'v-3',
    code: 'VIP10',
    title: 'মেগা ডিসকাউন্ট ভাউচার',
    discountText: '১০% ছাড়',
    minSpendText: 'সর্বনিম্ন ৳২,০০০ অর্ডারে প্রযোজ্য',
    validUntil: 'স্টক থাকা পর্যন্ত'
  }
];

export default function StoreVouchers({
  vouchers = DEFAULT_VOUCHERS,
  primaryColor = '#0EA5E9'
}: StoreVouchersProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`কুপন কোড "${code}" কপি হয়েছে! চেকআউটে ব্যবহার করুন।`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const displayList = vouchers && vouchers.length > 0 ? vouchers : DEFAULT_VOUCHERS;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <Ticket className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">দোকানের এক্সক্লুসিভ কুপন ও ভাউচার</h3>
            <p className="text-xs text-slate-500">অর্ডার করার সময় কোড ব্যবহার করে আকর্ষণীয় ছাড় পান</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayList.map((voucher) => {
          const isCopied = copiedCode === voucher.code;
          return (
            <div 
              key={voucher.id}
              className="relative flex items-stretch bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-sm transition-all group"
            >
              {/* Left Notch / Badge */}
              <div 
                className="w-24 sm:w-28 p-3 text-white flex flex-col items-center justify-center text-center relative shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                <Sparkles className="w-4 h-4 text-white/80 mb-1" />
                <span className="text-sm sm:text-base font-extrabold leading-tight">{voucher.discountText}</span>
                <span className="text-[10px] text-white/80 mt-0.5">অফ</span>
                {/* Perforation dots */}
                <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-between py-1 z-10">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="w-3.5 h-3.5 bg-slate-50 rounded-full my-0.5" />
                  ))}
                </div>
              </div>

              {/* Right Content */}
              <div className="flex-1 p-3 pl-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{voucher.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{voucher.minSpendText}</p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-slate-100">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <Clock className="w-3 h-3" />
                    <span>{voucher.validUntil || 'চলমান অফার'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(voucher.code)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                    style={{
                      backgroundColor: isCopied ? '#10b981' : '#f8fafc',
                      color: isCopied ? '#ffffff' : primaryColor,
                      borderColor: isCopied ? '#10b981' : `${primaryColor}40`,
                      borderWidth: '1px'
                    }}
                  >
                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'কপি হয়েছে' : voucher.code}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
