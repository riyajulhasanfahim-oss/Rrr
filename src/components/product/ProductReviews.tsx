import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Star, 
  ThumbsUp, 
  CheckCircle, 
  ChevronRight, 
  Camera, 
  Loader2, 
  Store, 
  ZoomIn, 
  X, 
  Play, 
  MessageSquare, 
  Calendar,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  isProductDeliveredToUser, 
  submitProductReview,
  getCachedProductReviews,
  subscribeToProductReviews,
  ReviewEligibility,
  ProductReview
} from '../../services/reviewService';
import { StorageManager } from '../../services/storage/StorageManager';
import ImageLightboxModal from '../common/ImageLightboxModal';

// Robust helper to extract vendor reply information
function getVendorReplyInfo(review: any): { text: string; vendorName: string; repliedAt?: number } | null {
  if (!review) return null;
  if (typeof review.vendorReply === 'string' && review.vendorReply.trim()) {
    return {
      text: review.vendorReply.trim(),
      vendorName: review.vendorName || 'দোকানদার',
      repliedAt: review.repliedAt || review.vendorReplyAt
    };
  }
  if (review.vendorReply && typeof review.vendorReply === 'object') {
    const txt = review.vendorReply.text || review.vendorReply.reply || review.vendorReply.message || '';
    if (txt.trim()) {
      return {
        text: txt.trim(),
        vendorName: review.vendorReply.vendorName || review.vendorName || 'দোকানদার',
        repliedAt: review.vendorReply.repliedAt || review.vendorReply.createdAt
      };
    }
  }
  if (typeof review.reply === 'string' && review.reply.trim()) {
    return {
      text: review.reply.trim(),
      vendorName: review.vendorName || 'দোকানদার',
      repliedAt: review.repliedAt
    };
  }
  if (review.reply && typeof review.reply === 'object') {
    const txt = review.reply.text || review.reply.message || '';
    if (txt.trim()) {
      return {
        text: txt.trim(),
        vendorName: review.reply.vendorName || review.vendorName || 'দোকানদার',
        repliedAt: review.reply.repliedAt || review.reply.createdAt
      };
    }
  }
  return null;
}

export default function ProductReviews({ productId }: { productId: string }) {
  const { user, userData } = useAuth();
  const navigate = useNavigate();

  const [reviews, setReviews] = useState<any[]>(() => getCachedProductReviews(productId));
  const [eligibility, setEligibility] = useState<ReviewEligibility>({ canReview: false, isDelivered: false });
  const [loading, setLoading] = useState(() => reviews.length === 0);

  // UI state for Daraz style compact review system
  const [isExpandedAll, setIsExpandedAll] = useState(false);
  const [filterWithMedia, setFilterWithMedia] = useState(false);
  const [selectedReviewForDetails, setSelectedReviewForDetails] = useState<any | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Review submission state for verified buyers
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // 1. Live Reviews Real-Time Subscription (Instant from cache + RTDB sync)
  useEffect(() => {
    let isMounted = true;
    if (!productId) {
      setReviews([]);
      setLoading(false);
      return;
    }

    const cached = getCachedProductReviews(productId);
    if (cached.length > 0) {
      setReviews(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const unsubscribe = subscribeToProductReviews(productId, (liveReviews) => {
      if (isMounted) {
        setReviews(liveReviews);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [productId]);

  // 2. Background check for user delivery eligibility
  useEffect(() => {
    let isMounted = true;
    const uid = user?.uid;
    const phone = user?.phoneNumber || (userData as any)?.phone;
    const email = user?.email || (userData as any)?.email;

    if (!uid || !productId) {
      setEligibility({ canReview: false, isDelivered: false, reason: 'not_purchased' });
      return;
    }

    isProductDeliveredToUser(productId, uid, phone, email)
      .then((el) => {
        if (isMounted) {
          setEligibility(el);
        }
      })
      .catch((err) => {
        console.warn('Notice checking review eligibility in background:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [productId, user?.uid, (userData as any)?.phone, (userData as any)?.email]);

  // 3. Star Priority Sorting: 5-star ALWAYS first, then 4, 3, 2, 1. Within same star, newest first.
  const sortedReviews = useMemo(() => {
    let list = [...reviews];
    if (filterWithMedia) {
      list = list.filter((r) => Array.isArray(r.images) && r.images.length > 0);
    }

    return list.sort((a, b) => {
      const starA = Math.round(Number(a.rating) || 5);
      const starB = Math.round(Number(b.rating) || 5);
      if (starB !== starA) {
        return starB - starA; // 5 -> 4 -> 3 -> 2 -> 1
      }
      const timeA = Number(a.createdAt) || 0;
      const timeB = Number(b.createdAt) || 0;
      return timeB - timeA; // newest first within same star tier
    });
  }, [reviews, filterWithMedia]);

  const reviewsWithMediaCount = useMemo(() => {
    return reviews.filter((r) => Array.isArray(r.images) && r.images.length > 0).length;
  }, [reviews]);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return '0.0';
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  // Compact review list: maximum 3 reviews initially
  const displayedReviews = isExpandedAll ? sortedReviews : sortedReviews.slice(0, 3);
  const hasMoreThanThree = sortedReviews.length > 3;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (reviewImages.length + files.length > 4) {
      toast.error('সর্বোচ্চ ৪টি ছবি যোগ করতে পারবেন');
      return;
    }

    setUploadingImage(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} ফাইলটি অনেক বড় (সর্বোচ্চ 5MB)`);
          continue;
        }
        try {
          const storedRecord = await StorageManager.uploadProductImage(file);
          if (storedRecord?.fileUrl) {
            newUrls.push(storedRecord.fileUrl);
          } else {
            throw new Error('No URL');
          }
        } catch {
          const base64: string = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newUrls.push(base64);
        }
      }
      setReviewImages((prev) => [...prev, ...newUrls]);
    } catch {
      toast.error('ছবি আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('রিভিউ দেওয়ার জন্য লগইন করুন');
      return;
    }

    if (!rating || rating < 1) {
      toast.error('রেটিং নির্বাচন করুন');
      return;
    }

    if (!reviewText.trim()) {
      toast.error('আপনার মতামত লিখুন');
      return;
    }

    if (!eligibility.canReview || !eligibility.orderId) {
      toast.error('পণ্যটি ডেলিভারি সম্পন্ন হওয়ার পরই রিভিউ দেওয়া সম্ভব।');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitProductReview({
        orderId: eligibility.orderId,
        productId,
        productName: eligibility.orderItem?.name || eligibility.orderItem?.title || '',
        productImage: eligibility.orderItem?.image || eligibility.orderItem?.thumbnail || '',
        userId: user.uid,
        reviewerName: userData?.name || user.displayName || 'Customer',
        reviewerPhoto: userData?.photo || user.photoURL || '',
        rating,
        text: reviewText.trim(),
        images: reviewImages,
        accountType: userData?.accountType || (userData as any)?.role
      });

      if (result.success && result.reviewId) {
        toast.success(result.message || 'রিভিউ সফলভাবে জমা হয়েছে!');
        setReviews((prev) => [
          {
            id: result.reviewId,
            productId,
            userId: user.uid,
            reviewerName: userData?.name || user.displayName || 'Customer',
            reviewerPhoto: userData?.photo || user.photoURL || '',
            rating,
            text: reviewText.trim(),
            images: reviewImages,
            createdAt: Date.now(),
            verifiedPurchase: true,
            isDelivered: true
          },
          ...prev
        ]);
        setEligibility((prev) => ({ ...prev, canReview: false, alreadyReviewed: true }));
        setShowReviewForm(false);
        setReviewText('');
        setReviewImages([]);
        setRating(5);
      } else {
        toast.error(result.error || 'রিভিউ জমা দেওয়া সম্ভব হয়নি');
      }
    } catch (err: any) {
      toast.error(err?.message || 'ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="py-4 flex items-center justify-center gap-2 text-slate-400 text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        <span>রিভিউ লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 font-sans" id="reviews">
      
      {/* 1. Daraz Style Header: Single row, clean, concise */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
            রেটিং এবং রিভিউ ({reviews.length})
          </h3>
          {eligibility.canReview && !showReviewForm && (
            <button
              type="button"
              onClick={() => setShowReviewForm(true)}
              className="text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 cursor-pointer flex items-center gap-1"
            >
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>রিভিউ দিন</span>
            </button>
          )}
        </div>

        {reviews.length > 0 ? (
          <div 
            onClick={() => hasMoreThanThree && setIsExpandedAll(prev => !prev)}
            className={`flex items-center gap-1.5 ${hasMoreThanThree ? 'cursor-pointer hover:opacity-80' : ''}`}
            title={hasMoreThanThree ? 'সব রিভিউ দেখতে ক্লিক করুন' : undefined}
          >
            <span className="text-sm sm:text-base font-black text-slate-900 leading-none">
              {avgRating}
            </span>
            <div className="flex text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= Math.round(Number(avgRating)) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium">কোনো রিভিউ নেই</span>
        )}
      </div>

      {/* Daraz Style Filter Pill (e.g. With images/videos) */}
      {reviewsWithMediaCount > 0 && (
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setFilterWithMedia((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border cursor-pointer ${
              filterWithMedia
                ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-2xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <span>With images/videos ({reviewsWithMediaCount})</span>
          </button>
          {filterWithMedia && (
            <button
              type="button"
              onClick={() => setFilterWithMedia(false)}
              className="text-[11px] text-slate-400 hover:text-slate-700 underline"
            >
              সব দেখান
            </button>
          )}
        </div>
      )}

      {/* Inline Review Writing Form for Verified Buyer */}
      {showReviewForm && (
        <div className="bg-amber-50/40 p-3 sm:p-4 rounded-xl border border-amber-200/80 space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-amber-100">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>আপনার অভিজ্ঞতা শেয়ার করুন (Write Review)</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              ✕ বাতিল
            </button>
          </div>

          <div>
            <div className="flex items-center gap-1 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                >
                  <Star
                    className={`w-5 h-5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs font-bold text-slate-700">
                {rating === 5 && 'অসাধারণ (5/5)'}
                {rating === 4 && 'ভালো (4/5)'}
                {rating === 3 && 'মোটামুটি (3/5)'}
                {rating === 2 && 'খারাপ (2/5)'}
                {rating === 1 && 'খুব খারাপ (1/5)'}
              </span>
            </div>
          </div>

          <div>
            <textarea
              rows={2}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
              placeholder="পণ্যের গুণমান, ব্যবহার অভিজ্ঞতা বা ডেলিভারি সম্পর্কে লিখুন..."
            />
          </div>

          {/* Photo attachment */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {reviewImages.map((img, i) => (
                <div
                  key={i}
                  className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-2xs"
                >
                  <img
                    src={img}
                    referrerPolicy="no-referrer"
                    alt={`Attachment ${i}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setReviewImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[9px]"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {reviewImages.length < 4 && (
                <label className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 hover:border-amber-500 bg-white flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0">
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[9px] font-semibold text-slate-500">ছবি</span>
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
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowReviewForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              disabled={submitting || !reviewText.trim()}
              onClick={handleSubmitReview}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>জমা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3" />
                  <span>রিভিউ সাবমিট করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. Review List (Max 3 initial, compact Daraz style cards) */}
      {displayedReviews.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {displayedReviews.map((review, idx) => {
            const replyInfo = getVendorReplyInfo(review);
            const isVerified = Boolean(review.verifiedPurchase || review.isDelivered || review.orderId);
            const imagesList = Array.isArray(review.images) ? review.images : [];

            return (
              <div
                key={review.id || idx}
                onClick={() => setSelectedReviewForDetails(review)}
                className="py-2.5 sm:py-3 hover:bg-slate-50/70 rounded-xl px-1 sm:px-2 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  
                  {/* Left Column: Review Text + User info & Star Rating + Mini Seller Reply */}
                  <div className="flex-1 min-w-0">
                    {/* Clamped review text */}
                    <p className="text-slate-800 text-xs sm:text-[13px] leading-snug line-clamp-2 break-words">
                      {review.text}
                    </p>
                    {review.text && review.text.length > 85 && (
                      <span className="text-[11px] font-bold text-sky-600 hover:text-sky-700 mt-0.5 inline-block">
                        আরও দেখুন...
                      </span>
                    )}

                    {/* Rating Stars + Customer Name + Verified Badge */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <div className="flex text-amber-400 shrink-0">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${
                              star <= (Number(review.rating) || 5)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>

                      <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[130px]">
                        {review.reviewerName || 'Customer'}
                      </span>

                      {/* Verified Order Badge (Requirement 4) */}
                      {isVerified && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                          <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                          Verified • অর্ডার পেয়েছে
                        </span>
                      )}

                      {review.createdAt && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          • {new Date(review.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>

                    {/* Seller/Vendor Reply - Mini Compact Chip (Requirement 5 & 9) */}
                    {replyInfo && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReviewForDetails(review);
                        }}
                        className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-900 rounded-md border border-sky-100 text-[10px] sm:text-[11px] font-medium transition-colors max-w-full"
                        title="বিক্রেতার পূর্ণ উত্তর দেখতে ক্লিক করুন"
                      >
                        <Store className="w-3 h-3 text-primary-main shrink-0" />
                        <span className="truncate">
                          বিক্রেতার উত্তর: "{replyInfo.text.slice(0, 32)}{replyInfo.text.length > 32 ? '...' : ''}"
                        </span>
                        <span className="text-primary-main font-bold text-[10px] shrink-0">বিস্তারিত &gt;</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Mini square thumbnails (Max 2 with +N badge and video play icon) */}
                  {imagesList.length > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                      {imagesList.slice(0, 2).map((mediaUrl: string, mIdx: number) => {
                        const isVideo =
                          mediaUrl.endsWith('.mp4') ||
                          mediaUrl.includes('video') ||
                          mediaUrl.includes('youtu');
                        const isSecondAndHasMore = mIdx === 1 && imagesList.length > 2;
                        const extraCount = imagesList.length - 2;

                        return (
                          <div
                            key={mIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReviewForDetails(review);
                            }}
                            className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer shadow-2xs hover:opacity-90"
                          >
                            <img
                              src={mediaUrl}
                              referrerPolicy="no-referrer"
                              alt="Review attachment"
                              className="w-full h-full object-cover"
                            />
                            {isVideo && (
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-white/80 flex items-center justify-center text-slate-800">
                                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                                </div>
                              </div>
                            )}
                            {isSecondAndHasMore && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[11px] font-bold">
                                +{extraCount}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="py-3 px-3 bg-slate-50/70 rounded-xl border border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-medium">
            এখনো কোনো রিভিউ যোগ করা হয়নি। আপনি পণ্যটি অর্ডার করে থাকলে ডেলিভারির পর প্রথম রিভিউ দিতে পারবেন।
          </p>
        </div>
      )}

      {/* 3. More Reviews: View All Reviews / Show Less (Requirement 8) */}
      {hasMoreThanThree && (
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
          <button
            type="button"
            id="view-all-reviews-btn"
            onClick={() => setIsExpandedAll((prev) => !prev)}
            className="inline-flex items-center gap-1 font-bold text-primary-main hover:text-sky-700 py-1 cursor-pointer transition-colors"
          >
            <span>
              {isExpandedAll ? 'কম রিভিউ দেখুন (Show Less)' : `সব রিভিউ দেখুন (${sortedReviews.length})`}
            </span>
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isExpandedAll ? '-rotate-90' : 'rotate-90'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => navigate(`/product/${productId}/reviews`)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
          >
            ফুল রিভিউ পেজ &gt;
          </button>
        </div>
      )}

      {/* 4. Review Details Modal (Requirement 6) */}
      {selectedReviewForDetails && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedReviewForDetails(null)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-xl flex flex-col border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                রিভিউ বিবরণ (Review Details)
              </h4>
              <button
                type="button"
                onClick={() => setSelectedReviewForDetails(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              
              {/* Reviewer Header */}
              <div className="flex items-center gap-3">
                {selectedReviewForDetails.reviewerPhoto ? (
                  <img
                    src={selectedReviewForDetails.reviewerPhoto}
                    referrerPolicy="no-referrer"
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-main/10 text-primary-main flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedReviewForDetails.reviewerName?.charAt(0) || 'C'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="font-bold text-slate-900 text-sm">
                      {selectedReviewForDetails.reviewerName || 'Customer'}
                    </h5>
                    {Boolean(
                      selectedReviewForDetails.verifiedPurchase ||
                      selectedReviewForDetails.isDelivered ||
                      selectedReviewForDetails.orderId
                    ) && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                        Verified • অর্ডার পেয়েছে
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= (Number(selectedReviewForDetails.rating) || 5)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    {selectedReviewForDetails.createdAt && (
                      <span className="text-xs text-slate-400">
                        • {new Date(selectedReviewForDetails.createdAt).toLocaleDateString('bn-BD', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Review Text */}
              <div className="bg-slate-50/70 p-3 sm:p-3.5 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedReviewForDetails.text}
              </div>

              {/* Full Photos / Videos Gallery */}
              {Array.isArray(selectedReviewForDetails.images) &&
                selectedReviewForDetails.images.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-2">
                      সংযুক্ত ছবি/ভিডিও ({selectedReviewForDetails.images.length})
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {selectedReviewForDetails.images.map((imgUrl: string, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedImage(imgUrl)}
                          className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:ring-2 hover:ring-primary-main transition-all cursor-pointer group"
                        >
                          <img
                            src={imgUrl}
                            referrerPolicy="no-referrer"
                            alt="Review item"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                            <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Full Seller/Vendor Reply */}
              {(() => {
                const replyInfo = getVendorReplyInfo(selectedReviewForDetails);
                if (!replyInfo) return null;
                return (
                  <div className="p-3.5 sm:p-4 bg-sky-50/80 border border-sky-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-sky-950 text-xs sm:text-sm">
                        <Store className="w-4 h-4 text-primary-main shrink-0" />
                        <span>বিক্রেতার উত্তর ({replyInfo.vendorName}):</span>
                      </div>
                      {replyInfo.repliedAt && (
                        <span className="text-[11px] text-sky-800 font-medium">
                          {new Date(replyInfo.repliedAt).toLocaleDateString('bn-BD', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-900 text-xs sm:text-sm leading-relaxed pl-3 border-l-2 border-primary-main/60 whitespace-pre-wrap font-medium">
                      {replyInfo.text}
                    </p>
                  </div>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReviewForDetails(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                বন্ধ করুন (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Lightbox */}
      <ImageLightboxModal
        isOpen={!!selectedImage}
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
        title="রিভিউ ছবি (Review Image)"
      />

    </div>
  );
}
