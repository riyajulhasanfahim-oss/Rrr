import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { 
  MessageSquare, 
  ArrowLeft, 
  Star, 
  Trash2, 
  ExternalLink, 
  ShoppingBag, 
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Store,
  ChevronRight,
  Sparkles,
  PackageCheck
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { rtdbGet, rtdbRemove } from '../../lib/rtdb';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../utils/imageUrl';
import { 
  getDeliveredUnreviewedItems, 
  fetchUserReviews, 
  UnreviewedDeliveredItem, 
  ProductReview 
} from '../../services/reviewService';
import ReviewModal from '../../components/reviews/ReviewModal';
import toast from 'react-hot-toast';

export default function MyReviewsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'to-review';
  const [activeTab, setActiveTab] = useState<'to-review' | 'history'>(initialTab);

  const [toReviewItems, setToReviewItems] = useState<UnreviewedDeliveredItem[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Review modal state
  const [selectedToReviewItem, setSelectedToReviewItem] = useState<UnreviewedDeliveredItem | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [unreviewed, userRevs] = await Promise.all([
        getDeliveredUnreviewedItems(user.uid, user.phoneNumber || undefined, user.email || undefined),
        fetchUserReviews(user.uid)
      ]);

      setToReviewItems(unreviewed);
      setReviews(userRevs);

      // If no items to review but has history, default to history tab unless query param specified
      if (unreviewed.length === 0 && userRevs.length > 0 && !searchParams.get('tab')) {
        setActiveTab('history');
      }
    } catch (err) {
      console.error('Failed to load review data:', err);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: 'to-review' | 'history') => {
    setActiveTab(tab);
    setSearchParams(tab === 'history' ? { tab: 'history' } : {});
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'reviews', id)).catch(() => null);
      // 2. Delete from RTDB
      await rtdbRemove(`reviews/${id}`).catch(() => null);
      await rtdbRemove(`vendor_reviews/${id}`).catch(() => null);

      toast.success('Review deleted');
      setReviews(prev => prev.filter(r => r.id !== id && r.reviewId !== id));
      // Re-check unreviewed items
      if (user) {
        getDeliveredUnreviewedItems(user.uid, user.phoneNumber || undefined, user.email || undefined)
          .then(setToReviewItems)
          .catch(() => null);
      }
    } catch (e) {
      toast.error('Failed to delete review');
    }
  };

  const handleReviewSuccess = () => {
    // Refresh both lists
    loadData();
    setActiveTab('history');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-2.5 sm:pt-6 pb-24 md:pb-16 px-3 sm:px-6 max-w-4xl mx-auto w-full">
        {/* Top Mobile Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-1.5 sm:p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
                My Reviews (রিভিউ)
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Manage your product reviews and rate delivered items
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs mb-5">
          <button
            type="button"
            onClick={() => handleTabChange('to-review')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'to-review'
                ? 'bg-primary-main text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>To Review (রিভিউ দিন)</span>
            {toReviewItems.length > 0 && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'to-review' ? 'bg-white text-primary-main' : 'bg-rose-500 text-white'
              }`}>
                {toReviewItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-primary-main text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>My Reviews (আমার দেওয়া রিভিউ)</span>
            {reviews.length > 0 && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'history' ? 'bg-white text-primary-main' : 'bg-slate-100 text-slate-700'
              }`}>
                {reviews.length}
              </span>
            )}
          </button>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-4 rounded-xl sm:rounded-2xl shadow-2xs border border-slate-200/80 animate-pulse">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                  <div className="h-4 bg-slate-200 rounded w-16"></div>
                </div>
                <div className="h-3.5 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : activeTab === 'to-review' ? (
          /* ========================================================
             TAB 1: TO REVIEW (DELIVERED ITEMS AWAITING REVIEW)
             ======================================================== */
          toReviewItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-2xs border border-slate-200/80 my-2">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600">
                <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                কোনো রিভিউ বাকি নেই! (All caught up)
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-5 max-w-sm mx-auto">
                আপনার ডেলিভারিকৃত সকল পণ্যের রিভিউ সম্পন্ন হয়েছে অথবা বর্তমানে কোনো ডেলিভারি সম্পন্ন পণ্য বাকি নেই।
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/orders')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-main text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-sky-600 active:scale-95 transition-all shadow-xs"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>My Orders (আমার অর্ডার)</span>
                </button>
                {reviews.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleTabChange('history')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>View Submitted Reviews ({reviews.length})</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <p>
                  আপনার সফলভাবে ডেলিভারিকৃত পণ্যগুলোর জন্য রিভিউ লিখুন। <strong>একটি পণ্যে সর্বোচ্চ ১টি রিভিউ</strong> দেওয়া যাবে।
                </p>
              </div>

              {toReviewItems.map(item => (
                <div
                  key={`${item.orderId}_${item.productId}`}
                  className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-2xs border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <img
                      src={formatDirectImageUrl(item.productImage) || PLACEHOLDER_PRODUCT_IMAGE}
                      referrerPolicy="no-referrer"
                      alt={item.productName}
                      className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl object-cover border border-slate-100 shrink-0 bg-slate-50"
                      onError={(e) => handleProductImageError(e)}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Delivered</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Order #{item.orderId.slice(-8)}
                        </span>
                      </div>

                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">
                        {item.productName}
                      </h3>

                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {item.price ? (
                          <span className="font-bold text-slate-800">
                            ৳{Number(item.price).toLocaleString()}
                          </span>
                        ) : null}
                        {item.deliveredDate ? (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.deliveredDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedToReviewItem(item)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      <Star className="w-4 h-4 fill-white" />
                      <span>রিভিউ দিন (Write Review)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ========================================================
             TAB 2: SUBMITTED REVIEWS (WITH VENDOR REPLIES)
             ======================================================== */
          reviews.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-2xs border border-slate-200/80 my-2">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-500">
                <Star className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                এখনো কোনো রিভিউ জমা দেননি
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-5 max-w-xs mx-auto">
                আপনি এখনো কোনো রিভিউ দেননি। ডেলিভারিকৃত পণ্যগুলোর রিভিউ দিয়ে আপনার অভিজ্ঞতা জানান!
              </p>
              {toReviewItems.length > 0 ? (
                <button
                  onClick={() => handleTabChange('to-review')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-main text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-sky-600 active:scale-95 transition-all shadow-xs"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Review Delivered Items ({toReviewItems.length})</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/orders')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-main text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-sky-600 active:scale-95 transition-all shadow-xs"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>View Delivered Orders</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {reviews.map(review => (
                <div
                  key={review.id || review.reviewId}
                  className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-2xs border border-slate-200/80 hover:border-slate-300 transition-all"
                >
                  {/* Header row: Product name + Stars + Date + Delete */}
                  <div className="flex items-start justify-between gap-2 mb-2 pb-2.5 border-b border-slate-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                                i < review.rating ? 'fill-current' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          {review.rating}/5
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Verified Purchase
                        </span>
                      </div>

                      {review.productName && (
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-1 line-clamp-1">
                          {review.productName}
                        </h4>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {review.createdAt
                          ? new Date(review.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : 'Recent'}
                      </span>
                      <button
                        onClick={() => handleDelete(review.id || review.reviewId)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="Delete review"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Review Text */}
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words">
                    {review.text || (review as any).comment || 'No written text provided.'}
                  </p>

                  {/* Review Images */}
                  {review.images && review.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {review.images.map((img: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedImage(img)}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 active:scale-95 transition-all relative cursor-pointer"
                        >
                          <img
                            src={img}
                            referrerPolicy="no-referrer"
                            alt={`Review attachment ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Vendor Reply Highlight Box */}
                  {review.vendorReply && review.vendorReply.text && (
                    <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <Store className="w-3.5 h-3.5 text-primary-main" />
                          <span>{review.vendorReply.vendorName || review.vendorName || 'Seller'} এর রিপ্লাই:</span>
                        </div>
                        {review.vendorReply.repliedAt && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(review.vendorReply.repliedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 leading-relaxed pl-5 border-l-2 border-primary-main/60">
                        {review.vendorReply.text}
                      </p>
                    </div>
                  )}

                  {/* Product link footer */}
                  {review.productId && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => navigate(`/product/${review.productId}`)}
                        className="text-xs font-bold text-primary-main hover:text-sky-700 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View Product</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Modal Lightbox for Previewing Review Image */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-lg w-full max-h-[85vh] flex items-center justify-center">
              <img
                src={selectedImage}
                referrerPolicy="no-referrer"
                alt="Enlarged review photo"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Review Modal for unreviewed items */}
        {selectedToReviewItem && (
          <ReviewModal
            isOpen={true}
            onClose={() => setSelectedToReviewItem(null)}
            orderId={selectedToReviewItem.orderId}
            productId={selectedToReviewItem.productId}
            productName={selectedToReviewItem.productName}
            productImage={selectedToReviewItem.productImage}
            vendorId={selectedToReviewItem.vendorId}
            onSuccess={handleReviewSuccess}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
