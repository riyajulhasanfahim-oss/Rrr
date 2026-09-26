import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { 
  BookOpen, ArrowLeft, ArrowRight, Calendar, Clock, 
  Tag, Share2, Sparkles, TrendingUp, ShieldCheck 
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  snippet: string;
  category: string;
  readTime: string;
  date: string;
  image: string;
}

const ARTICLES: Article[] = [
  {
    id: 'reseller-guide-2026',
    title: 'How to Start an Online Reselling Business in Bangladesh with Zero Capital',
    snippet: 'Discover how the RJ WORLD BD Reseller Platform empowers students, homemakers, and young entrepreneurs to set up their own branded web store and earn high profit margins on verified products.',
    category: 'Reseller Business',
    readTime: '4 min read',
    date: 'September 2026',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'safe-online-shopping',
    title: 'The Ultimate Checklist for Safe Online Shopping & Cash on Delivery in Bangladesh',
    snippet: 'Learn how to inspect parcel packaging, verify courier tracking codes via Steadfast and Pathao, and ensure you always receive genuine products at your doorstep.',
    category: 'Shopping Tips',
    readTime: '3 min read',
    date: 'August 2026',
    image: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'courier-tracking-explained',
    title: 'Understanding Real-Time Courier Tracking: From Warehouse to Your Doorstep',
    snippet: 'A step-by-step breakdown of order statuses—from vendor packaging and consignment handover to courier dispatch and doorstep collection.',
    category: 'Logistics',
    readTime: '5 min read',
    date: 'July 2026',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'vendor-success-tips',
    title: 'Scaling Local Manufacturing: Why Multi-Vendor Marketplaces are the Future in Bangladesh',
    snippet: 'How local manufacturers and verified suppliers can multiply their monthly sales volume through a distributed network of active online resellers.',
    category: 'Vendor Insights',
    readTime: '4 min read',
    date: 'June 2026',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&auto=format&fit=crop&q=80'
  }
];

export default function BlogPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-4 sm:pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
          <button 
            type="button"
            onClick={() => navigate(-1)} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span>/</span>
          <Link to="/" className="hover:text-primary-main">Home</Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold">Blog & Insights</span>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-2xs mb-8">
          <div className="max-w-2xl">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 inline-block mb-2">
              RJ WORLD BD Insights
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              E-Commerce, Reselling & Shopping Guides
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Explore educational articles, business tips for resellers and vendors, and smart shopping advice for Bangladeshi consumers.
            </p>
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {ARTICLES.map((art) => (
            <article 
              key={art.id}
              className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="h-48 sm:h-52 w-full overflow-hidden bg-slate-100 relative">
                <img 
                  src={art.image} 
                  alt={art.title} 
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-bold">
                  {art.category}
                </span>
              </div>

              <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-2.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {art.date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {art.readTime}
                    </span>
                  </div>

                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug hover:text-primary-main transition-colors">
                    {art.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed line-clamp-3">
                    {art.snippet}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <Link 
                    to="/products"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-main hover:text-sky-700"
                  >
                    <span>Shop Featured Products</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link 
                    to="/become-reseller"
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Join as Reseller
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
