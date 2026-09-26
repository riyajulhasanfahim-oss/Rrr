import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import { Product } from '../../../components/ui/ProductCard';
import { Search, Filter, Share2, Link as LinkIcon, Heart, Copy, Share, ArrowRight, Download } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { fetchAllMarketplaceProducts, subscribeToMarketplaceProducts, getCachedMarketplaceProducts } from '../../../services/productService';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../../utils/imageUrl';

const COMMISSION_RATE = 0.10; // 10% default commission fallback

export default function ResellerProducts() {
  const { userData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>(() => {
    return getCachedMarketplaceProducts().filter(p => (p as any).status !== 'Draft' && (p as any).status !== 'Inactive');
  });
  const [loading, setLoading] = useState<boolean>(() => products.length === 0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetchAllMarketplaceProducts()
      .then(all => {
        if (isMounted) {
          setProducts(all.filter(p => (p as any).status !== 'Draft' && (p as any).status !== 'Inactive'));
          setLoading(false);
        }
      })
      .catch(error => {
        console.warn("Notice fetching products for reseller:", error);
        if (isMounted) setLoading(false);
      });

    const unsubscribe = subscribeToMarketplaceProducts(liveList => {
      if (isMounted) {
        setProducts(liveList.filter(p => (p as any).status !== 'Draft' && (p as any).status !== 'Inactive'));
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleShare = (product: Product) => {
    setSelectedProduct(product);
    setIsShareModalOpen(true);
  };

  const generateReferralLink = (productSlug: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/product/${productSlug}?ref=${userData?.uid || 'UNKNOWN'}`;
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  const handleNativeShare = async (link: string, productName: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: `Check out ${productName} on RJ WORLD BD!`,
          url: link,
        });
        toast.success('Shared successfully!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink(link);
        }
      }
    } else {
      handleCopyLink(link);
    }
  };

  const shareOnSocial = (platform: string, link: string) => {
    let url = '';
    const text = `Check out this amazing product on RJ WORLD BD!`;
    switch (platform) {
      case 'whatsapp': url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + link)}`; break;
      case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`; break;
      case 'twitter': url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`; break;
      case 'telegram': url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`; break;
    }
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50  flex flex-col">
      <Header />
      
      <main className="flex-grow py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 ">Reseller Products</h1>
          <p className="mt-2 text-gray-600 ">Browse products, get your referral links, and start earning commission.</p>
        </div>

        {/* Search & Filter */}
        <div className="mb-8 flex flex-col sm gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300  rounded-lg bg-white  text-gray-900  focus focus focus outline-none"
            />
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300  rounded-lg bg-white  text-gray-700  hover  transition-colors">
            <Filter className="h-5 w-5 mr-2" />
            Filter
          </button>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white  rounded-xl border border-gray-200  overflow-hidden flex flex-col shadow-sm hover transition-shadow">
              <Link to={`/product/${product.id}`} state={{ product }} className="relative aspect-square block hover transition-opacity">
                <img 
                  referrerPolicy="no-referrer" 
                  src={formatDirectImageUrl(product.featuredImage) || PLACEHOLDER_PRODUCT_IMAGE} 
                  alt={product.name}
                  onError={(e) => handleProductImageError(e)}
                  className="w-full h-full object-cover" 
                />
              </Link>
              <div className="p-4 flex flex-col flex-grow">
                <Link to={`/product/${product.id}`} state={{ product }}>
                  <h3 className="text-lg font-semibold text-gray-900  line-clamp-2 mb-2 hover transition-colors">{product.name}</h3>
                </Link>
                
                <div className="mt-auto">
                  {(() => {
                    const shopPrice = Number(product.price) || 0;
                    const hasVendorResellerPrice = product.resellerPrice !== undefined && product.resellerPrice !== null && Number(product.resellerPrice) > 0;
                    const resellerPrice = hasVendorResellerPrice ? Number(product.resellerPrice) : shopPrice;
                    const estProfit = Math.max(0, shopPrice - resellerPrice);

                    return (
                      <>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-500 text-sm">রিসেলার প্রাইস:</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-emerald-700 font-black text-base">৳{resellerPrice.toLocaleString()}</span>
                            {hasVendorResellerPrice && resellerPrice !== shopPrice && (
                              <span className="text-xs text-gray-400 line-through">৳{shopPrice.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-emerald-50 rounded-lg p-2.5 mb-4 border border-emerald-100">
                          <div className="flex justify-between items-center">
                            <span className="text-emerald-700 text-xs font-medium">প্রত্যাশিত প্রফিট:</span>
                            <span className="text-emerald-700 font-bold text-sm">
                              ৳{(estProfit > 0 ? estProfit : (shopPrice * COMMISSION_RATE)).toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleShare(product)}
                      className="flex-grow inline-flex justify-center items-center px-4 py-2 bg-primary-main text-white rounded-lg hover transition-colors text-sm font-medium"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </button>
                    <button 
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = (product.featuredImage || '').includes("drive.google.com") ? (product.featuredImage || '').replace("export=view", "export=download") : (product.featuredImage || '');
                        link.download = product.name + ".jpg";
                        link.target = "_blank";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      title="Download Image"
                      className="p-2 border border-gray-300 rounded-lg text-gray-600 hover transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      
                    </button>
                    <button className="p-2 border border-gray-300  rounded-lg text-gray-600  hover  transition-colors">
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Share Modal */}
      {isShareModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white  rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 ">Share & Earn</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="text-gray-500 hover ">
                ✕
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50  rounded-xl">
              <img 
                referrerPolicy="no-referrer" 
                src={formatDirectImageUrl(selectedProduct.featuredImage) || PLACEHOLDER_PRODUCT_IMAGE} 
                alt={selectedProduct.name} 
                onError={(e) => handleProductImageError(e)}
                className="w-16 h-16 object-cover rounded-lg" 
              />
              <div>
                <p className="font-medium text-gray-900 line-clamp-1">{selectedProduct.name}</p>
                {(() => {
                  const shopPrice = Number(selectedProduct.price) || 0;
                  const hasVendorResellerPrice = selectedProduct.resellerPrice !== undefined && selectedProduct.resellerPrice !== null && Number(selectedProduct.resellerPrice) > 0;
                  const resellerPrice = hasVendorResellerPrice ? Number(selectedProduct.resellerPrice) : shopPrice;
                  const estProfit = Math.max(0, shopPrice - resellerPrice);
                  return (
                    <p className="text-emerald-600 font-semibold text-sm mt-1">
                      প্রত্যাশিত প্রফিট ৳{(estProfit > 0 ? estProfit : (shopPrice * COMMISSION_RATE)).toFixed(0)} / sale
                    </p>
                  );
                })()}
              </div>
            </div>

            <div className="mb-6 text-center">
              <div className="bg-white p-4 rounded-xl inline-block border border-gray-200">
                <QRCodeSVG value={generateReferralLink(selectedProduct.slug || selectedProduct.id)} size={150} />
              </div>
              <p className="text-sm text-gray-500 mt-2">Scan to visit referral link</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700  mb-2">Your Referral Link</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={generateReferralLink(selectedProduct.slug || selectedProduct.id)}
                  className="flex-grow px-3 py-2 bg-gray-100  border border-gray-300  rounded-lg text-sm text-gray-600  focus"
                />
                <button 
                  onClick={() => handleCopyLink(generateReferralLink(selectedProduct.slug || selectedProduct.id))}
                  className="px-4 py-2 bg-gray-900  text-white  rounded-lg text-sm font-medium hover  transition-colors cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={() => handleNativeShare(generateReferralLink(selectedProduct.slug || selectedProduct.id), selectedProduct.name)}
                className="w-full mb-4 py-2 px-3 bg-sky-50 text-primary-main rounded-lg text-xs font-bold border border-sky-200 hover:bg-sky-100 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Share via Device Apps</span>
              </button>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700  mb-3 text-center">Share instantly</p>
              <div className="flex justify-center gap-4">
                <button onClick={() => shareOnSocial('whatsapp', generateReferralLink(selectedProduct.slug || selectedProduct.id))} className="p-3 bg-green-500 text-white rounded-full hover transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.391.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z"/></svg>
                </button>
                <button onClick={() => shareOnSocial('facebook', generateReferralLink(selectedProduct.slug || selectedProduct.id))} className="p-3 bg-blue-600 text-white rounded-full hover transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                </button>
                <button onClick={() => shareOnSocial('twitter', generateReferralLink(selectedProduct.slug || selectedProduct.id))} className="p-3 bg-black text-white rounded-full hover transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </button>
                <button onClick={() => shareOnSocial('telegram', generateReferralLink(selectedProduct.slug || selectedProduct.id))} className="p-3 bg-blue-500 text-white rounded-full hover transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.61 3.72-.53.37-1.01.55-1.44.54-.47-.01-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.44-.88.03-.24.36-.48.99-.74 3.88-1.69 6.47-2.8 7.77-3.34 3.69-1.54 4.46-1.81 4.96-1.82.11 0 .35.03.48.14.11.09.14.22.14.34-.01.07-.02.21-.03.35z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
