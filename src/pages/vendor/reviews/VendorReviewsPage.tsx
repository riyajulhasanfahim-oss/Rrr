import React, { useState, useEffect } from 'react';
import VendorLayout from '../../../components/layout/VendorLayout';
import { useAuth } from '../../../context/AuthContext';
import { useVendorStore } from '../../../context/VendorStoreContext';
import { 
  fetchVendorReviews, 
  replyToCustomerReview, 
  ProductReview 
} from '../../../services/reviewService';
import { 
  Star, 
  MessageSquare, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Send, 
  CornerDownRight, 
  Edit3, 
  ExternalLink,
  ShoppingBag,
  Sparkles,
  Calendar,
  AlertCircle,
  ThumbsUp,
  Store,
  RefreshCw,
  X,
  ZoomIn
} from 'lucide-react';
import toast from 'react-hot-toast';
import ImageLightboxModal from '../../../components/common/ImageLightboxModal';

// Helper to robustly extract vendor reply information
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

export default function VendorReviewsPage() {
  const { user, userData } = useAuth();
  const { vendorInfo } = useVendorStore();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [filterTab, setFilterTab] = useState<'all' | 'unreplied' | 'replied' | '5' | '4' | '3' | '2' | '1'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Replying state
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Lightbox for photos
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const vendorId = user?.uid || '';
  const vendorName = vendorInfo?.shopName || vendorInfo?.storeName || userData?.name || 'Vendor';

  const loadReviews = async (showRefresh = false) => {
    if (!vendorId) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchVendorReviews(vendorId);
      setReviews(data);
    } catch (err) {
      console.error('Failed to load vendor reviews:', err);
      toast.error('রিভিউ লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [vendorId]);

  // Calculations & Analytics
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / totalReviews).toFixed(1)
    : '0.0';

  const repliedCount = reviews.filter(r => Boolean(getVendorReplyInfo(r))).length;
  const unrepliedCount = totalReviews - repliedCount;

  const ratingCounts = {
    5: reviews.filter(r => Math.round(Number(r.rating)) === 5).length,
    4: reviews.filter(r => Math.round(Number(r.rating)) === 4).length,
    3: reviews.filter(r => Math.round(Number(r.rating)) === 3).length,
    2: reviews.filter(r => Math.round(Number(r.rating)) === 2).length,
    1: reviews.filter(r => Math.round(Number(r.rating)) === 1).length,
  };

  // Filtered List
  const filteredReviews = reviews.filter(rev => {
    const replyInfo = getVendorReplyInfo(rev);
    // 1. Tab Filter
    if (filterTab === 'unreplied' && replyInfo) return false;
    if (filterTab === 'replied' && !replyInfo) return false;
    if (['1', '2', '3', '4', '5'].includes(filterTab)) {
      if (Math.round(Number(rev.rating)) !== Number(filterTab)) return false;
    }

    // 2. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const customer = (rev.reviewerName || rev.customerName || '').toLowerCase();
      const product = (rev.productName || '').toLowerCase();
      const text = (rev.text || (rev as any).comment || '').toLowerCase();
      return customer.includes(q) || product.includes(q) || text.includes(q);
    }

    return true;
  });

  const handleStartReply = (review: ProductReview) => {
    const revId = review.id || review.reviewId || '';
    setReplyingReviewId(revId);
    const replyInfo = getVendorReplyInfo(review);
    setReplyText(replyInfo?.text || review.vendorReply?.text || '');
  };

  const handleCancelReply = () => {
    setReplyingReviewId(null);
    setReplyText('');
  };

  const handleSendReply = async (reviewId: string) => {
    if (!replyText.trim()) {
      toast.error('অনুগ্রহ করে রিপ্লাই লিখুন');
      return;
    }

    setIsSubmittingReply(true);
    try {
      const success = await replyToCustomerReview({
        reviewId,
        vendorId,
        vendorName,
        replyText: replyText.trim()
      });

      if (success) {
        toast.success('রিভিউতে সফলভাবে রিপ্লাই দেওয়া হয়েছে!');
        // Update local state instantly
        setReviews(prev => prev.map(r => {
          if (r.id === reviewId || r.reviewId === reviewId) {
            return {
              ...r,
              vendorReply: {
                text: replyText.trim(),
                repliedAt: Date.now(),
                vendorId,
                vendorName
              }
            };
          }
          return r;
        }));
        setReplyingReviewId(null);
        setReplyText('');
      } else {
        toast.error('রিপ্লাই সংরক্ষণ করতে সমস্যা হয়েছে');
      }
    } catch (e) {
      toast.error('রিপ্লাই পাঠাতে ব্যর্থ হয়েছে');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const quickReplies = [
    'আপনার মূল্যবান মতামতের জন্য অসংখ্য ধন্যবাদ! ❤️',
    'আমাদের পণ্য পছন্দ করায় ধন্যবাদ। আবারও কেনাকাটা করার আমন্ত্রণ রইল!',
    'দুঃখিত আপনার সমস্যার জন্য। আমরা সবসময় মানসম্মত সেবা দিতে সচেষ্ট।'
  ];

  return (
    <VendorLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900">
                Customer Reviews (গ্রাহকের রিভিউ)
              </h1>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {totalReviews} Reviews
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              আপনার স্টোরের বিক্রি হওয়া পণ্যের গ্রাহক রিভিউ দেখুন ও সরাসরি রিপ্লাই দিন
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadReviews(true)}
            disabled={refreshing}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary-main' : 'text-gray-500'}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Analytics & Rating Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Average Rating Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center text-amber-500 shrink-0">
              <span className="text-2xl font-black text-amber-600 leading-none">{averageRating}</span>
              <div className="flex text-amber-400 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star
                    key={i}
                    className={`w-2.5 h-2.5 ${i <= Math.round(Number(averageRating)) ? 'fill-amber-400' : 'text-slate-200'}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Average Store Rating</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                মোট {totalReviews} টি সফল ডেলিভারিকৃত অর্ডারের গড় রেটিং
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>100% Authentic Verified Buyers</span>
                </span>
              </div>
            </div>
          </div>

          {/* Reply Status Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reply Status</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900">{repliedCount}</span>
                <span className="text-xs text-gray-500">/ {totalReviews} Replied</span>
              </div>
              <p className="text-[11px] text-gray-400">
                গ্রাহকের রিভিউতে দ্রুত রিপ্লাই দিলে স্টোরের গ্রহণযোগ্যতা বৃদ্ধি পায়
              </p>
            </div>
            <div className="text-right">
              {unrepliedCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                  <Clock className="w-3 h-3" />
                  <span>{unrepliedCount} Pending</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>All Replied</span>
                </span>
              )}
            </div>
          </div>

          {/* Star Distribution Breakdown */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-2xs space-y-1.5">
            {[5, 4, 3, 2, 1].map(stars => {
              const count = (ratingCounts as any)[stars] || 0;
              const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1 w-10 text-gray-600 font-semibold shrink-0">
                    <span>{stars}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 w-8 text-right font-mono">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'all', label: `All (${totalReviews})` },
              { id: 'unreplied', label: `Pending Reply (${unrepliedCount})` },
              { id: 'replied', label: `Replied (${repliedCount})` },
              { id: '5', label: '5 ★' },
              { id: '4', label: '4 ★' },
              { id: '3', label: '3 ★' },
              { id: '2', label: '2 ★' },
              { id: '1', label: '1 ★' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  filterTab === tab.id
                    ? 'bg-primary-main text-white shadow-xs'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer, product, text..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-gray-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-gray-200 animate-pulse space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
                <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-800">কোনো রিভিউ পাওয়া যায়নি</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {searchQuery || filterTab !== 'all'
                ? 'আপনার বর্তমান ফিল্টারের সাথে মিলে এমন কোনো রিভিউ পাওয়া যায়নি।'
                : 'আপনার স্টোরের কোনো পণ্যের জন্য এখনো গ্রাহকরা রিভিউ প্রদান করেননি। অর্ডার ডেলিভারি হলে গ্রাহকরা রিভিউ দিতে পারবেন।'}
            </p>
            {(searchQuery || filterTab !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterTab('all');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map(review => {
              const reviewId = review.id || review.reviewId || '';
              const isReplying = replyingReviewId === reviewId;
              const replyInfo = getVendorReplyInfo(review);
              const hasVendorReply = Boolean(replyInfo);

              return (
                <div
                  key={reviewId}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs hover:border-gray-300 transition-all space-y-3"
                >
                  {/* Top Bar: Customer + Product + Rating + Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100">
                    {/* Customer Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 overflow-hidden shrink-0">
                        {review.customerPhoto || review.reviewerPhoto ? (
                          <img
                            src={review.customerPhoto || review.reviewerPhoto}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (review.reviewerName || review.customerName || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-gray-900">
                            {review.reviewerName || review.customerName || 'Verified Customer'}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Verified Purchase</span>
                          </span>
                        </div>
                        {review.orderId && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            Order #{review.orderId.slice(-8)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stars + Date */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="flex items-center gap-1">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i <= Number(review.rating) ? 'fill-amber-400' : 'text-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-gray-800">{review.rating}/5</span>
                      </div>

                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {review.createdAt
                          ? new Date(review.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : 'Recent'}
                      </span>
                    </div>
                  </div>

                  {/* Product Mini Banner */}
                  {review.productName && (
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      {review.productImage && (
                        <img
                          src={review.productImage}
                          referrerPolicy="no-referrer"
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-gray-500 text-[11px]">Reviewed Product: </span>
                        <strong className="text-gray-800 truncate font-semibold">{review.productName}</strong>
                      </div>
                      {review.productId && (
                        <a
                          href={`/product/${review.productId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-main hover:text-sky-700 flex items-center gap-1 text-[11px] font-bold shrink-0"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Customer Review Text */}
                  <p className="text-xs sm:text-sm text-gray-800 leading-relaxed break-words pl-1">
                    {review.text || (review as any).comment || 'কোনো লিখিত মন্তব্য নেই।'}
                  </p>

                  {/* Review Photos attached by customer */}
                  {review.images && review.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 pl-1">
                      {review.images.map((img: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightboxImage(img)}
                          className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 hover:ring-2 hover:ring-primary-main transition-all cursor-pointer shadow-2xs shrink-0 text-left"
                          title="বড় করে দেখতে ক্লিক করুন"
                        >
                          <img
                            src={img}
                            referrerPolicy="no-referrer"
                            alt={`Photo ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                            <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Existing Vendor Reply Block */}
                  {hasVendorReply && !isReplying && replyInfo && (
                    <div className="mt-3 p-3.5 sm:p-4 rounded-xl bg-sky-50/85 border border-sky-200 text-xs sm:text-sm space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-bold text-sky-950">
                          <Store className="w-4 h-4 text-primary-main shrink-0" />
                          <span>আপনার উত্তর ({replyInfo.vendorName || vendorName})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {replyInfo.repliedAt && (
                            <span className="text-[11px] text-sky-800 font-medium">
                              {new Date(replyInfo.repliedAt).toLocaleDateString('bn-BD', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartReply(review)}
                            className="text-xs font-bold text-primary-main hover:underline flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded-md border border-sky-200"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-900 leading-relaxed pl-5 border-l-2 border-primary-main/60 whitespace-pre-wrap font-medium">
                        {replyInfo.text}
                      </p>
                    </div>
                  )}

                  {/* Reply Action / Reply Form */}
                  {!hasVendorReply && !isReplying && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleStartReply(review)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-primary-main to-sky-600 hover:from-sky-600 hover:to-sky-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        <CornerDownRight className="w-3.5 h-3.5" />
                        <span>রিভিউ এর রিপ্লাই দিন (Reply to Review)</span>
                      </button>
                    </div>
                  )}

                  {/* Interactive Inline Reply Form */}
                  {isReplying && (
                    <div className="mt-3 p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-primary-main" />
                          <span>রিভিউ রিপ্লাই লিখুন:</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelReply}
                          className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quick Reply Suggestions */}
                      <div className="flex flex-wrap gap-1.5">
                        {quickReplies.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setReplyText(q)}
                            className="text-[11px] bg-white hover:bg-sky-50 text-gray-700 hover:text-primary-main px-2.5 py-1 rounded-lg border border-gray-200 transition-colors cursor-pointer text-left"
                          >
                            + {q}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={3}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="গ্রাহকের উদ্দেশ্যে আপনার কৃতজ্ঞতা বা উত্তর লিখুন..."
                        className="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-gray-900 resize-none"
                      />

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCancelReply}
                          disabled={isSubmittingReply}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReply(reviewId)}
                          disabled={isSubmittingReply || !replyText.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary-main hover:bg-sky-600 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSubmittingReply ? 'পাঠানো হচ্ছে...' : 'Send Reply'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* Lightbox for review image enlargement */}
        <ImageLightboxModal
          isOpen={!!lightboxImage}
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
          title="কাস্টমার রিভিউ ছবি (Customer Review Photo)"
        />

      </div>
    </VendorLayout>
  );
}
