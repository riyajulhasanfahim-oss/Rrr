import React, { useState, useRef, useEffect } from 'react';
import { Search, Camera, Mic, Clock, TrendingUp, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../ui/ProductCard';
import { searchFirestoreProducts, addSearchHistoryToFirestore } from '../../services/firestoreService';
import { fetchAllMarketplaceProducts } from '../../services/productService';
import { searchProductsByImage } from '../../utils/searchEngine';
import { auth } from '../../lib/firebase';
import toast from 'react-hot-toast';

const RECENT_SEARCHES = ['Headphones', 'Smart Watch', 'Backpack'];
const TRENDING_SEARCHES = ['iPhone 15', 'Wireless Earbuds', 'Gaming Mouse', 'Mechanical Keyboard'];
const POPULAR_CATEGORIES = ['Electronics', 'Fashion', 'Beauty & Personal Care', 'Home & Living'];

interface ProfessionalSearchProps {
  placeholder?: string;
  className?: string;
}

export default function ProfessionalSearch({ placeholder = 'Search in RJ WORLD BD...', className = '' }: ProfessionalSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<Product[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;
    if (query.trim() === '') {
      setLiveSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const results = await searchFirestoreProducts(query);
        if (active) {
          setLiveSuggestions(results.slice(0, 6));
        }
      } catch (e) {
        console.warn('Search error in ProfessionalSearch:', e);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    if (auth.currentUser) {
      addSearchHistoryToFirestore(auth.currentUser.uid, searchTerm);
    }
    setQuery(searchTerm);
    setIsFocused(false);
    navigate(`/category/all?q=${encodeURIComponent(searchTerm.trim())}`);
  };
  
  const handleCategoryClick = (category: string) => {
    setIsFocused(false);
    navigate(`/category/${category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`);
  };
  
  const handleProductClick = (product: any) => {
    setIsFocused(false);
    navigate(`/product/${product.id}`, { state: { product } });
  };

  const clearSearch = () => {
    setQuery('');
    setIsFocused(true);
  };

  const startVoiceSearch = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }
    
    if (!('webkitSpeechRecognition' in window)) {
      toast.error('Voice search is not supported in your browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Microphone permission denied', err);
      toast.error('Please allow microphone access to use voice search.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsListening(false);
      handleSearch(transcript);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        console.error('Speech recognition error', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Image search: scans all vendor products using visual AI and displays identical / similar products
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected if desired
    event.target.value = '';

    setIsAnalyzingImage(true);
    setQuery('ছবি সার্চ করা হচ্ছে...');
    setIsFocused(false);

    const toastId = toast.loading('সকল ভেন্ডারের পণ্য থেকে ছবি মিলিয়ে দেখা হচ্ছে...');

    try {
      const allVendorProducts = await fetchAllMarketplaceProducts();
      const result = await searchProductsByImage(file, allVendorProducts);

      toast.dismiss(toastId);

      const targetTerm = result.searchQuery || result.detectedItem;

      if (result.matchedProducts.length > 0) {
        toast.success(`${result.matchedProducts.length} টি মিল থাকা পণ্য পাওয়া গেছে!`);
        // Navigate to CategoryView with the detected query term and pass matched products in state
        navigate(`/category/all?q=${encodeURIComponent(targetTerm)}`, {
          state: {
            imageSearchMatches: result.matchedProducts,
            detectedItem: result.detectedItem,
            isImageSearch: true,
            uploadedImagePreview: result.uploadedPreview,
            similarityScores: result.similarityScores
          }
        });
      } else {
        toast.error('দুঃখিত, এই ছবির সাথে মিল থাকা কোনো পণ্য পাওয়া যায়নি।');
        navigate(`/category/all?q=${encodeURIComponent(targetTerm || 'image-search')}`, {
          state: {
            imageSearchMatches: [],
            detectedItem: result.detectedItem || file.name,
            isImageSearch: true,
            uploadedImagePreview: result.uploadedPreview
          }
        });
      }
    } catch (err) {
      console.error('Visual image search error:', err);
      toast.dismiss(toastId);
      toast.error('ছবি প্রসেস করতে সাময়িক সমস্যা হয়েছে। নাম দিয়ে খুঁজুন।');
    } finally {
      setIsAnalyzingImage(false);
      setQuery('');
    }
  };

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      <div className="relative flex items-center w-full">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={isListening ? 'শুনছি, বলুন...' : isAnalyzingImage ? 'ছবি বিশ্লেষণ করা হচ্ছে...' : placeholder}
          className="w-full pl-4 pr-32 py-2.5 bg-slate-100 border border-transparent focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 rounded-lg text-sm transition-all duration-300 outline-none placeholder:text-slate-500"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {query && !isAnalyzingImage && (
            <button 
              type="button"
              onClick={clearSearch}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {isAnalyzingImage ? (
            <div className="p-1.5 text-primary-main animate-spin" title="Analyzing image">
              <Loader2 className="w-4 h-4" />
            </div>
          ) : (
            <>
              <button 
                type="button"
                onClick={startVoiceSearch}
                className={`p-1.5 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-primary-main'}`}
                title="ভয়েস দিয়ে সার্চ করুন"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-slate-400 hover:text-primary-main transition-colors"
                title="ছবি দিয়ে সব ভেন্ডারের প্রোডাক্ট সার্চ করুন"
              >
                <Camera className="w-4 h-4" />
              </button>
            </>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <button 
            type="button"
            onClick={() => handleSearch(query)}
            className="p-1.5 bg-primary-main text-white rounded-md hover:bg-sky-600 transition-colors ml-1 cursor-pointer"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Dropdown overlay */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50"
          >
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
              {query.trim() === '' ? (
                <>
                  {/* Recent Searches */}
                  <div className="p-4 border-b border-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" /> Recent Searches
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {RECENT_SEARCHES.map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => handleSearch(term)}
                          className="px-3 py-1.5 bg-slate-50 text-slate-700 text-xs rounded-full hover:bg-slate-100 transition-colors border border-slate-100 cursor-pointer"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Trending Searches */}
                  <div className="p-4 border-b border-slate-50">
                    <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-red-500" /> Trending Now
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {TRENDING_SEARCHES.map((term, idx) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => handleSearch(term)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-700 text-xs rounded-full hover:bg-rose-100 transition-colors border border-rose-100 cursor-pointer"
                        >
                          <span className="font-bold">{idx + 1}</span> {term}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Popular Categories */}
                  <div className="p-4">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">Popular Categories</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {POPULAR_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleCategoryClick(cat)}
                          className="text-left px-3 py-2 text-sm text-slate-600 hover:text-primary-main hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-2">
                  {liveSuggestions.length > 0 ? (
                    liveSuggestions.map((product) => (
                      <button 
                        key={product.id}
                        type="button"
                        onClick={() => handleProductClick(product)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-4 transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
                      >
                        <img referrerPolicy="no-referrer" src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-md" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-slate-800 line-clamp-1">{product.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold text-primary-main">৳{product.price}</span>
                            {product.discount && product.discount > 0 && (
                              <span className="text-xs text-rose-500 bg-rose-50 px-1 rounded">-{product.discount}%</span>
                            )}
                            <span className="text-xs text-amber-500 ml-auto flex items-center">⭐ {product.rating}</span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No matching products found. Try a different keyword.
                    </div>
                  )}
                  <button 
                    type="button"
                    onClick={() => handleSearch(query)}
                    className="w-full text-center px-4 py-3 text-sm text-primary-main hover:bg-primary-main/5 font-medium border-t border-slate-100 cursor-pointer"
                  >
                    View all results for "{query}"
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
