import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, ThumbsUp, CheckCircle, Image as ImageIcon, ChevronRight, MessageSquare, ShoppingBag, Camera, Loader2, Trash2, Store, ZoomIn } from 'lucide-react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { rtdbGet, rtdbList } from '../lib/rtdb';
import { fetchProductById } from '../services/productService';
import { useAuth } from '../context/AuthContext';
import { StorageManager } from '../services/storage/StorageManager';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ImageLightboxModal from '../components/common/ImageLightboxModal';
import toast from 'react-hot-toast';
import { 
  isProductDeliveredToUser, 
  fetchProductReviews, 
  submitProductReview, 
  getCachedProductReviews,
  subscribeToProductReviews,
  ReviewEligibility 
} from '../services/reviewService';

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

export default function ProductReviewsPage() {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userData } = useAuth();

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>(() => getCachedProductReviews(productId || ''));
  const [filteredReviews, setFilteredReviews] = useState<any[]>(() => getCachedProductReviews(productId || ''));
  const [filter, setFilter] = useState<string>('All');
  const [loading, setLoading] = useState(() => reviews.length === 0);

  // Review submission state
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 1. Scroll to top & Load product context for header
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!productId) return;

    fetchProductById(productId).then((rawProd) => {
      if (rawProd) {
        setProduct({
          id: productId,
          name: rawProd.name,
          image: rawProd.featuredImage || rawProd.image || (Array.isArray(rawProd.images) ? rawProd.images[0] : '') || '',
          price: Number(rawProd.price) || 0,
          category: rawProd.category || '',
          brand: rawProd.brand || '',
        });
      }
    }).catch(err => console.warn('Notice loading product header for reviews:', err));
  }, [productId]);

  // 2. Real-time Live Review Subscription (Instant render from cache)
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

  // 3. User purchase & delivery eligibility check in background (never delays reviews)
  useEffect(() => {
    let isMounted = true;
    const uid = user?.uid;
    const phone = user?.phoneNumber || (userData as any)?.phone;
    const email = user?.email || (userData as any)?.email;

    if (!uid || !productId) {
      setEligibility({ canReview: false, isDelivered: false, reason: 'not_purchased' });
      setCanReview(false);
      return;
    }

    isProductDeliveredToUser(productId, uid, phone, email)
      .then((el) => {
        if (isMounted) {
          setEligibility(el);
          setCanReview(el.canReview);
        }
      })
      .catch((err) => {
        console.warn('Notice checking review eligibility in background:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [productId, user?.uid, (userData as any)?.phone, (userData as any)?.email]);

  // Filter & Star Priority Sort effect: 5-star first, then 4, 3, 2, 1. Within same star, newest first.
  useEffect(() => {
    let list: any[] = [];
    if (filter === 'All') {
      list = [...reviews];
    } else if (filter === 'With Images') {
      list = reviews.filter(r => r.images && r.images.length > 0);
    } else {
      const starRating = parseInt(filter.split(' ')[0], 10);
      list = reviews.filter(r => Number(r.rating) === starRating);
    }

    list.sort((a, b) => {
      const starA = Math.round(Number(a.rating) || 5);
      const starB = Math.round(Number(b.rating) || 5);
      if (starB !== starA) {
        return starB - starA; // 5 -> 4 -> 3 -> 2 -> 1
      }
      const timeA = Number(a.createdAt) || 0;
      const timeB = Number(b.createdAt) || 0;
      return timeB - timeA;
    });

    setFilteredReviews(list);
  }, [filter, reviews]);

  const handleSubmitReview = async () => {
    if (!rating || !reviewText.trim()) {
      toast.error('Please provide a rating and review text');
      return;
    }
    if (!productId || !user) return;

    if (!eligibility?.canReview || !eligibility.orderId) {
      toast.error('রিভিউ শুধুমাত্র ডেলিভারি সম্পন্ন হওয়ার পর দেওয়া যাবে।');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitProductReview({
        orderId: eligibility.orderId,
        productId,
        productName: product?.name || eligibility.orderItem?.name || '',
        productImage: product?.image || eligibility.orderItem?.image || '',
        userId: user.uid,
        reviewerName: userData?.name || user.displayName || 'Customer',
        reviewerPhoto: userData?.photo || user.photoURL || '',
        rating,
        text: reviewText.trim(),
        images: reviewImages,
        vendorId: product?.vendorId,
        vendorName: product?.vendorName
      });

      if (result.success && result.reviewId) {
        const updatedReviews = await fetchProductReviews(productId);
        setReviews(updatedReviews);
        setFilteredReviews(updatedReviews);
        setCanReview(false);
        setEligibility(prev => prev ? { ...prev, canReview: false, alreadyReviewed: true } : null);
        setShowReviewForm(false);
        setReviewText('');
        setReviewImages([]);
        setRating(5);
        toast.success('ধন্যবাদ! আপনার রিভিউ সফলভাবে জমা হয়েছে। (Review submitted!)');
      } else {
        toast.error(result.error || 'Failed to submit review');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (reviewImages.length + files.length > 4) {
      toast.error('সর্বোচ্চ ৪টি ছবি যোগ করতে পারবেন (Max 4 photos allowed)');
      return;
    }

    setUploadingImage(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} ফাইলটি অনেক বড় (সর্বোচ্চ ২৫MB)`);
          continue;
        }

        try {
          const storedRecord = await StorageManager.uploadProductImage(file, {
            productId,
            userId: user?.uid
          });
          if (storedRecord?.fileUrl) {
            newUrls.push(storedRecord.fileUrl);
          } else {
            throw new Error('No URL returned');
          }
        } catch (uploadErr) {
          console.warn('StorageManager upload fallback to local preview:', uploadErr);
          const base64: string = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newUrls.push(base64);
        }
      }

      setReviewImages(prev => [...prev, ...newUrls]);
      toast.success(`${newUrls.length}টি ছবি যুক্ত হয়েছে`);
    } catch (err) {
      console.error('Failed to attach image:', err);
      toast.error('ছবি আপলোড করা যায়নি');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setReviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  const filterOptions = ['All', '5 Star', '4 Star', '3 Star', '2 Star', '1 Star', 'With Images'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-3 sm:pt-6 pb-8 sm:pb-12">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Back button & Breadcrumb */}
          <div className="flex items-center gap-2 mb-4">
            <Link
              to={`/product/${productId}`}
              id="back-to-product-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-slate-700 hover:text-primary-main text-xs font-semibold shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Product</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium truncate">Customer Reviews</span>
          </div>

          {/* Product Summary Header Card */}
          {product && (
            <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-xs mb-4 flex items-center gap-3 sm:gap-4">
              {product.image && (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  <img
                    referrerPolicy="no-referrer"
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  to={`/product/${productId}`}
                  className="text-xs sm:text-sm md:text-base font-bold text-slate-900 hover:text-primary-main line-clamp-1 transition-colors"
                >
                  {product.name}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="font-bold text-slate-900">৳{product.price.toFixed(2)}</span>
                  {product.brand && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>{product.brand}</span>
                    </>
                  )}
                </div>
              </div>
              <Link
                to={`/product/${productId}`}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-primary-main hover:bg-sky-100 text-xs font-bold rounded-lg border border-sky-100 transition-colors shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>View Product</span>
              </Link>
            </div>
          )}

          {/* Ratings Overview Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-xs mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {avgRating}
                </div>
                <div>
                  <div className="flex text-yellow-400 mb-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(Number(avgRating)) ? 'fill-current' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                  </p>
                </div>
              </div>

              {canReview && !showReviewForm ? (
                <button
                  type="button"
                  onClick={() => setShowReviewForm(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-white" />
                  <span>Write a Review (রিভিউ দিন)</span>
                </button>
              ) : eligibility?.alreadyReviewed ? (
                <span className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold self-start sm:self-auto flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Reviewed (রিভিউ দেওয়া হয়েছে)</span>
                </span>
              ) : user && eligibility && !eligibility.isDelivered && eligibility.reason === 'not_delivered' ? (
                <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-xl text-xs font-medium self-start sm:self-auto">
                  ডেলিভারি সম্পন্ন হলে রিভিউ দিতে পারবেন
                </span>
              ) : null}
            </div>

            {/* Filter Pills */}
            {reviews.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-4">
                {filterOptions.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFilter(opt)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                      filter === opt
                        ? 'bg-primary-main text-white border-primary-main shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Review Form Drawer/Card */}
          {showReviewForm && (
            <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm mb-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-base sm:text-lg text-slate-900">Write a Review</h4>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Your Rating</label>
                <div className="flex gap-1.5 text-yellow-400">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="focus:outline-none hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 ${
                          star <= rating ? 'fill-current text-yellow-400' : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Review Details</label>
                <textarea
                  rows={4}
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-primary-main focus:ring-1 focus:ring-primary-main"
                  placeholder="What did you like or dislike about this product?"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  <span>Add Photos (Optional - সর্বোচ্চ ৪টি ছবি)</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Attached images preview */}
                  {reviewImages.map((img, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shrink-0">
                      <img
                        src={img}
                        referrerPolicy="no-referrer"
                        alt="Review upload"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove photo"
                      >
                        <Trash2 className="w-4 h-4 text-rose-300" />
                      </button>
                    </div>
                  ))}

                  {/* Upload button using StorageManager (same as product upload) */}
                  {reviewImages.length < 4 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-primary-main hover:bg-sky-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-primary-main transition-all cursor-pointer shrink-0">
                      {uploadingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary-main" />
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
                  সর্বোচ্চ ৪টি ছবি যুক্ত করতে পারেন (Max 4 photos, 25MB each)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || uploadingImage}
                  onClick={handleSubmitReview}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-xs">
            {loading && filteredReviews.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs font-medium">রিভিউ লোড হচ্ছে...</span>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/70 rounded-xl border border-slate-100">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-2xs border border-slate-200 text-slate-300">
                  <Star className="w-6 h-6" />
                </div>
                <p className="text-slate-700 font-bold text-sm">No reviews found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {filter !== 'All' ? 'Try changing your filter selection' : 'Be the first to leave a review!'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredReviews.map((review, idx) => (
                  <div key={review.id || idx} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 mb-2.5">
                      {review.reviewerPhoto ? (
                        <img
                          src={review.reviewerPhoto}
                          referrerPolicy="no-referrer"
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                          {review.reviewerName?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                            {review.reviewerName || 'Customer'}
                          </h5>
                          {review.verifiedPurchase && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-green-200">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Verified • অর্ডার পেয়েছে
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < (review.rating || 5) ? 'fill-current' : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          {review.createdAt && (
                            <span className="text-[11px] text-slate-400">
                              • {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-slate-700 text-xs sm:text-sm leading-relaxed mb-3">
                      {review.text}
                    </p>

                    {review.images && review.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {review.images.map((img: string, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedImage(img)}
                            className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-primary-main/50 transition-all cursor-pointer text-left shrink-0"
                            title="ছবিটি বড় করে দেখতে ক্লিক করুন"
                          >
                            <img
                              src={img}
                              referrerPolicy="no-referrer"
                              alt="Review photo"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-colors">
                              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-xs" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Vendor Reply Card */}
                    {(() => {
                      const replyInfo = getVendorReplyInfo(review);
                      if (!replyInfo) return null;
                      return (
                        <div className="mt-3 mb-3 p-3.5 sm:p-4 bg-sky-50/85 border border-sky-200 rounded-xl space-y-1.5 shadow-2xs">
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
                          <p className="text-slate-900 text-xs sm:text-sm leading-relaxed pl-5 border-l-2 border-primary-main/60 whitespace-pre-wrap font-medium">
                            {replyInfo.text}
                          </p>
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        <ThumbsUp className="w-3 h-3 text-slate-400" /> Helpful ({review.helpfulCount || 0})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={!!selectedImage}
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
        title="রিভিউ ফটো (Review Photo)"
      />
    </div>
  );
}
