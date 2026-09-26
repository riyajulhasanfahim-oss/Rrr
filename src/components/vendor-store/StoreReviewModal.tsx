import React, { useState, useEffect } from 'react';
import { 
  X, 
  Star, 
  Send, 
  ShieldCheck, 
  CheckCircle2, 
  ShoppingBag, 
  AlertCircle, 
  Loader2, 
  Camera, 
  Trash2, 
  ExternalLink 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  getVendorStoreReviewStatus, 
  submitProductReview, 
  UnreviewedDeliveredItem 
} from '../../services/reviewService';
import { StorageManager } from '../../services/storage/StorageManager';
import toast from 'react-hot-toast';

interface StoreReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  storeName: string;
  products?: any[];
  primaryColor?: string;
  onReviewAdded: (newReview: any) => void;
}

export default function StoreReviewModal({
  isOpen,
  onClose,
  vendorId,
  storeName,
  products = [],
  primaryColor = '#0284c7',
  onReviewAdded
}: StoreReviewModalProps) {
  const { user, userData } = useAuth();
  const navigate = useNavigate();

  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [eligibleItems, setEligibleItems] = useState<UnreviewedDeliveredItem[]>([]);
  const [alreadyReviewedCount, setAlreadyReviewedCount] = useState<number>(0);
  const [hasPurchased, setHasPurchased] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<UnreviewedDeliveredItem | null>(null);

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const checkStatus = async () => {
      if (!user) {
        setCheckingEligibility(false);
        setEligibleItems([]);
        setAlreadyReviewedCount(0);
        setHasPurchased(false);
        return;
      }

      setCheckingEligibility(true);
      try {
        const productIds = products.map(p => String(p.id || p._id || '')).filter(Boolean);
        const status = await getVendorStoreReviewStatus(
          vendorId,
          user.uid,
          user.phoneNumber || (userData as any)?.phone,
          user.email || (userData as any)?.email,
          productIds
        );

        setEligibleItems(status.unreviewedItems);
        setAlreadyReviewedCount(status.alreadyReviewedItemsCount);
        setHasPurchased(status.hasPurchasedFromStore);

        if (status.unreviewedItems.length > 0) {
          setSelectedItem(status.unreviewedItems[0]);
        } else {
          setSelectedItem(null);
        }
      } catch (err) {
        console.error('Error verifying customer purchase eligibility in modal:', err);
        setEligibleItems([]);
        setAlreadyReviewedCount(0);
      } finally {
        setCheckingEligibility(false);
      }
    };

    checkStatus();
  }, [isOpen, user, userData, vendorId, products]);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 4) {
      toast.error('সর্বোচ্চ ৪টি ছবি যোগ করতে পারবেন (Max 4 photos allowed)');
      return;
    }

    setUploadingImage(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} ফাইলটি অনেক বড় (সর্বোচ্চ ৫ মেগাবাইট)`);
          continue;
        }

        try {
          const storedRecord = await StorageManager.uploadProductImage(file);
          if (storedRecord?.fileUrl) {
            newUrls.push(storedRecord.fileUrl);
          } else {
            throw new Error('No URL returned');
          }
        } catch {
          // Fallback to base64 data URI
          const base64: string = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newUrls.push(base64);
        }
      }

      setImages(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('ছবি আপলোড করতে সমস্যা হয়েছে');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('রিভিউ দেওয়ার জন্য অনুগ্রহ করে লগইন করুন');
      return;
    }
    if (!selectedItem) {
      toast.error('রিভিউ দেওয়ার জন্য কোনো ভেরিফাইড ডেলিভারিকৃত পণ্য পাওয়া যায়নি');
      return;
    }
    if (!rating || rating < 1) {
      toast.error('অনুগ্রহ করে স্টার রেটিং নির্বাচন করুন');
      return;
    }
    if (!comment.trim()) {
      toast.error('অনুগ্রহ করে আপনার পণ্য ব্যবহারের অভিজ্ঞতা লিখুন');
      return;
    }

    setSubmitting(true);
    try {
      const reviewerName = userData?.name || (userData as any)?.displayName || user.displayName || 'ভেরিফাইড ক্রেতা';
      const reviewerPhoto = userData?.photo || user.photoURL || '';

      // Unified submission: updates RTDB reviews, RTDB vendor_reviews, Firestore reviews,
      // order.reviewedItems in RTDB & Firestore, and product/vendor statistics
      const result = await submitProductReview({
        orderId: selectedItem.orderId,
        productId: selectedItem.productId,
        productName: selectedItem.productName,
        productImage: selectedItem.productImage || '',
        userId: user.uid,
        reviewerName,
        reviewerPhoto,
        rating,
        text: comment.trim(),
        images,
        vendorId,
        vendorName: storeName
      });

      if (result.success && result.reviewId) {
        // Notify parent component to prepend review to store review list immediately
        onReviewAdded({
          id: result.reviewId,
          reviewId: result.reviewId,
          vendorId,
          userId: user.uid,
          customerName: reviewerName,
          reviewerName,
          customerPhoto: reviewerPhoto,
          reviewerPhoto,
          rating,
          comment: comment.trim(),
          text: comment.trim(),
          productId: selectedItem.productId,
          productName: selectedItem.productName,
          productImage: selectedItem.productImage || '',
          orderId: selectedItem.orderId,
          verifiedPurchase: true,
          createdAt: Date.now(),
          images
        });

        toast.success('ধন্যবাদ! আপনার ভেরিফাইড ক্রেতা রিভিউ সফলভাবে জমা হয়েছে।', {
          icon: '⭐',
          duration: 4000
        });

        // Update local eligibility state so user cannot submit again
        const remaining = eligibleItems.filter(
          it => !(it.orderId === selectedItem.orderId && it.productId === selectedItem.productId)
        );
        setEligibleItems(remaining);
        setAlreadyReviewedCount(prev => prev + 1);
        setComment('');
        setImages([]);
        setRating(5);
        onClose();
      } else {
        toast.error(result.error || 'রিভিউ সাবমিট করতে সমস্যা হয়েছে।');
      }
    } catch (error: any) {
      console.error('Error submitting verified review:', error);
      toast.error(error?.message || 'রিভিউ সাবমিট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">ভেরিফাইড ক্রেতা রিভিউ</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">{storeName} - আসল ক্রেতাদের মতামত</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {checkingEligibility ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
              <p className="text-xs text-slate-500 font-medium">আপনার ক্রয় ও ডেলিভারি তথ্য যাচাই করা হচ্ছে...</p>
            </div>
          ) : !user ? (
            /* User Not Logged In */
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">লগইন প্রয়োজন</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                শুধুমাত্র এই স্টোর থেকে পণ্য ক্রয়কারী ডেলিভারি সম্পন্ন আসল ক্রেতারা রিভিউ প্রদান করতে পারেন।
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          ) : eligibleItems.length === 0 ? (
            alreadyReviewedCount > 0 ? (
              /* Case A: User ALREADY Reviewed their purchases from this store */
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-2xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  রিভিউ দেওয়া সম্পন্ন হয়েছে (Already Reviewed)
                </h4>
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 max-w-sm mx-auto text-left text-xs text-emerald-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>১টি ক্রয়ের জন্য সর্বোচ্চ ১টি রিভিউ পলিসি:</span>
                  </p>
                  <p className="text-emerald-700 leading-relaxed text-[11px]">
                    আপনি ইতিমধ্যে এই স্টোরের ক্রয়কৃত পণ্যের জন্য আপনার মূল্যবান রিভিউ প্রদান করেছেন। একটি পণ্য একবার কিনলে সব মিলে শুধুমাত্র ১টি রিভিউই দেওয়া যায়।
                  </p>
                </div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  আপনার জমাকৃত রিভিউ স্টোর পেজের রিভিউ তালিকায় এবং আপনার প্রোফাইলে প্রদর্শিত হচ্ছে।
                </p>
                <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/profile/my-reviews?tab=history');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-main hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5 fill-white" />
                    <span>আমার দেওয়া রিভিউ দেখুন</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            ) : (
              /* Case B: No Delivered Purchases Found for this user from this store */
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">ভেরিফাইড পারচেজ পাওয়া যায়নি</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  আরজে ওয়ার্ল্ড বিডি-তে শুধুমাত্র <strong>সফলভাবে পণ্য ক্রয় ও ডেলিভারি সম্পন্ন</strong> করা আসল ক্রেতারাই রিভিউ দিতে পারেন। আপনার ক্রয়কৃত পণ্যের ডেলিভারি সম্পন্ন হওয়ার পর রিভিউ অপশন চালু হবে।
                </p>
                <div className="pt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/orders');
                    }}
                    className="px-4 py-2 bg-primary-main hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    আমার অর্ডার সমূহ দেখুন
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            )
          ) : (
            /* Valid Verified Customer Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>আপনি যে পণ্যটির রিভিউ দিতে চান:</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {eligibleItems.length}টি ডেলিভারিকৃত পণ্য বাকি
                  </span>
                </label>
                
                {eligibleItems.length === 1 ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30">
                    {eligibleItems[0].productImage ? (
                      <img 
                        src={eligibleItems[0].productImage} 
                        alt={eligibleItems[0].productName}
                        className="w-12 h-12 rounded-lg object-cover bg-white shrink-0 border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{eligibleItems[0].productName}</p>
                      <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>অর্ডার #{eligibleItems[0].orderId.slice(-6)} • ডেলিভারি সম্পন্ন</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {eligibleItems.map((item) => {
                      const isSelected = selectedItem?.productId === item.productId && selectedItem?.orderId === item.orderId;
                      return (
                        <button
                          key={`${item.orderId}_${item.productId}`}
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-500'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {item.productImage ? (
                            <img 
                              src={item.productImage} 
                              alt={item.productName}
                              className="w-10 h-10 rounded-lg object-cover bg-white shrink-0 border border-slate-200"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">{item.productName}</p>
                            <p className="text-[10px] text-slate-500">অর্ডার #{item.orderId.slice(-6)} • ডেলিভারি সম্পন্ন</p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Star Rating Selection */}
              <div className="text-center pt-2">
                <span className="block text-xs font-bold text-slate-700 mb-1.5">আপনার রেটিং দিন</span>
                <div className="flex items-center justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = hoverRating ? star <= hoverRating : star <= rating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none transform hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star 
                          className={`w-7 h-7 sm:w-8 sm:h-8 ${
                            active 
                              ? 'text-amber-400 fill-amber-400' 
                              : 'text-slate-200 fill-slate-100'
                          }`} 
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                  {rating === 5 ? '৫/৫ - চমৎকার অভিজ্ঞতা' :
                   rating === 4 ? '৪/৫ - সন্তোষজনক' :
                   rating === 3 ? '৩/৫ - মোটামুটি' :
                   rating === 2 ? '২/৫ - প্রত্যাশা অনুযায়ী নয়' : '১/৫ - অসন্তুষ্ট'}
                </span>
              </div>

              {/* Review Comment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  আপনার মতামত বা বিস্তারিত অভিজ্ঞতা
                </label>
                <textarea
                  required
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="পণ্যের গুণমান, প্যাকেজিং ও ব্যবহারের অভিজ্ঞতা সম্পর্কে লিখুন..."
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white transition-all resize-none text-slate-800"
                />
              </div>

              {/* Photo Upload (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    <span>পণ্যের ছবি যুক্ত করুন (ঐচ্ছিক)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">সর্বোচ্চ ৪টি</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {images.map((imgUrl, idx) => (
                    <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 group bg-slate-50">
                      <img 
                        src={imgUrl} 
                        alt={`Review preview ${idx + 1}`} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {images.length < 4 && (
                    <label className={`w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 hover:border-sky-500 hover:bg-sky-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-sky-600 transition-colors cursor-pointer ${
                      uploadingImage ? 'opacity-50 pointer-events-none' : ''
                    }`}>
                      {uploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4 mb-0.5" />
                          <span className="text-[9px] font-bold">+ছবি</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Policy note */}
              <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>এক ক্রয়ে একটি রিভিউ:</strong> এই অর্ডারের পণ্যের জন্য এটিই আপনার একমাত্র রিভিউ হবে। সাবমিট করার পর প্রোফাইল বা স্টোর থেকে দ্বিতীয়বার রিভিউ দেওয়া যাবে না।
                </p>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-opacity hover:opacity-90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'জমা হচ্ছে...' : 'ভেরিফাইড রিভিউ জমা দিন'}</span>
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
