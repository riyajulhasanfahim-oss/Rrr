import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Star, 
  UploadCloud, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  PackageCheck,
  Camera
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { submitProductReview } from '../../services/reviewService';
import { StorageManager } from '../../services/storage/StorageManager';
import toast from 'react-hot-toast';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../utils/imageUrl';

export interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  productId: string;
  productName: string;
  productImage?: string;
  vendorId?: string;
  vendorName?: string;
  onSuccess?: (reviewId: string) => void;
}

const RATING_DESCRIPTIONS = [
  { stars: 1, labelBn: 'খুব খারাপ', labelEn: 'Poor', color: 'text-rose-500' },
  { stars: 2, labelBn: 'চলনসই', labelEn: 'Fair', color: 'text-amber-500' },
  { stars: 3, labelBn: 'ভালো', labelEn: 'Good', color: 'text-yellow-500' },
  { stars: 4, labelBn: 'খুব ভালো', labelEn: 'Very Good', color: 'text-lime-600' },
  { stars: 5, labelBn: 'অসাধারণ', labelEn: 'Excellent', color: 'text-emerald-600' }
];

export default function ReviewModal({
  isOpen,
  onClose,
  orderId,
  productId,
  productName,
  productImage,
  vendorId,
  vendorName,
  onSuccess
}: ReviewModalProps) {
  const { user, userData } = useAuth();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const activeRating = hoverRating || rating;
  const ratingInfo = RATING_DESCRIPTIONS.find(r => r.stars === activeRating) || RATING_DESCRIPTIONS[4];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 4) {
      toast.error('You can upload a maximum of 4 photos for your review.');
      return;
    }

    setUploadingImage(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
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
      toast.success(`${newUrls.length} photo(s) added`);
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('Failed to attach image');
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
      toast.error('Please log in to submit a review');
      return;
    }

    if (!rating || rating < 1) {
      toast.error('Please select a star rating');
      return;
    }

    if (!reviewText.trim()) {
      toast.error('Please share your feedback about this product');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitProductReview({
        orderId,
        productId,
        productName,
        productImage,
        userId: user.uid,
        reviewerName: userData?.name || user.displayName || 'Customer',
        reviewerPhoto: userData?.photo || user.photoURL || '',
        rating,
        text: reviewText.trim(),
        images,
        vendorId,
        vendorName,
        accountType: userData?.accountType || (userData as any)?.role
      });

      if (result.success && result.reviewId) {
        toast.success(result.message || 'ধন্যবাদ! আপনার রিভিউ সফলভাবে জমা হয়েছে। (Review submitted!)', {
          duration: 4000,
          icon: '⭐'
        });
        if (onSuccess) {
          onSuccess(result.reviewId);
        }
        onClose();
      } else {
        toast.error(result.error || 'Failed to submit review');
      }
    } catch (err: any) {
      console.error('Failed to submit review:', err);
      toast.error(err?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-primary-main/10 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Star className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Write a Product Review
              </h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <PackageCheck className="w-3 h-3 text-emerald-600" />
                <span>Delivered Order #{orderId.substring(0, 10)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Delivered Product Card */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0">
              <img
                src={formatDirectImageUrl(productImage) || PLACEHOLDER_PRODUCT_IMAGE}
                referrerPolicy="no-referrer"
                alt={productName}
                onError={(e) => handleProductImageError(e)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Delivered
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 mt-0.5">
                {productName}
              </p>
              <p className="text-[11px] text-slate-500">
                Verified Purchase Review
              </p>
            </div>
          </div>

          {/* Star Rating Section */}
          <div className="text-center py-2 bg-slate-50/50 rounded-2xl border border-slate-100 p-4">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              আপনার রেটিং নির্বাচন করুন (Select Star Rating)
            </label>
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5].map(star => {
                const isFilled = star <= activeRating;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 sm:p-1.5 transition-transform active:scale-90 hover:scale-110 cursor-pointer focus:outline-none"
                  >
                    <Star
                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                          : 'text-slate-300 fill-transparent hover:text-amber-200'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-xs font-bold transition-all">
              <span className={ratingInfo.color}>
                {ratingInfo.stars}★ {ratingInfo.labelBn} ({ratingInfo.labelEn})
              </span>
            </div>
          </div>

          {/* Review Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                আপনার মতামত লিখুন (Your Review) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {reviewText.length} characters
              </span>
            </div>
            <textarea
              rows={4}
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="প্রোডাক্টের মান কেমন? প্যাকেজিং ও ডেলিভারি কেমন ছিল? আপনার বাস্তব অভিজ্ঞতা বিস্তারিত লিখুন..."
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
              required
            />
          </div>

          {/* Photo Attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              প্রোডাক্টের ছবি যুক্ত করুন (Add Photos - Optional)
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {/* Image Previews */}
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group bg-slate-100 shrink-0"
                >
                  <img
                    src={img}
                    referrerPolicy="no-referrer"
                    alt={`Preview ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove photo"
                  >
                    <Trash2 className="w-4 h-4 text-rose-300" />
                  </button>
                </div>
              ))}

              {/* Upload Button */}
              {images.length < 4 && (
                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 transition-all cursor-pointer shrink-0">
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px] font-bold">+Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploadingImage}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              সর্বোচ্চ ৪টি ছবি যুক্ত করতে পারেন (Max 4 photos, 5MB each)
            </p>
          </div>

          {/* Notice */}
          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>এক ক্রয়ে একটি রিভিউ:</strong> শুধুমাত্র সফলভাবে ডেলিভারি হওয়া পণ্যের জন্য ১টি রিভিউ দেওয়া যাবে। একবার রিভিউ দিলে স্টোর পেজ বা প্রোফাইল থেকে এই অর্ডারের জন্য দ্বিতীয়বার রিভিউ দেওয়া যাবে না।
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage || !reviewText.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 fill-white" />
                  <span>Submit Review (রিভিউ জমা দিন)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
