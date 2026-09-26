import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import LiveSupportChatBox from '../../components/support/LiveSupportChatBox';
import {
  HelpCircle,
  ArrowLeft,
  MessageSquare,
  BookOpen,
  Search,
  ChevronRight,
  ShieldCheck,
  Package,
  Truck,
  RotateCcw,
  CreditCard,
  User,
  Store
} from 'lucide-react';

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'chat' | 'topics'>('chat');
  const [searchQuery, setSearchQuery] = useState('');

  const helpTopics = [
    { title: 'অর্ডার ও ডেলিভারি', desc: 'অর্ডার ট্র্যাকিং, ডেলিভারি সময় ও চার্জ', icon: Truck },
    { title: 'পেমেন্ট ও রিফান্ড', desc: 'বিকাশ/নগদ/কার্ড পেমেন্ট ও ফেরত নীতি', icon: CreditCard },
    { title: 'রিটার্ন ও এক্সচেঞ্জ', desc: 'পণ্য পরিবর্তন ও ওয়ারেন্টি পলিসি', icon: RotateCcw },
    { title: 'ভেন্ডর অ্যাকাউন্ট', desc: 'পণ্য লিস্টিং ও পে-আউট সেটেলমেন্ট', icon: Store },
    { title: 'রিসেলার টিম ও কমিশন', desc: 'রেফারেল লিংক ও কমিশন উইথড্র', icon: User },
    { title: 'অ্যাকাউন্ট নিরাপত্তা', desc: 'পাসওয়ার্ড পরিবর্তন ও তথ্য সুরক্ষা', icon: ShieldCheck }
  ];

  const filteredTopics = helpTopics.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-6 pb-16 px-3 sm:px-6 max-w-4xl mx-auto w-full">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>প্রোফাইলে ফিরুন</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-primary-main text-xs font-bold border border-sky-100">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>হেল্প সেন্টার ডেস্ক</span>
          </span>
        </div>

        {/* Section Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary-main" />
                <span>হেল্প সেন্টার</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                যেকোনো প্রয়োজনে সরাসরি লাইভ চ্যাটে এডমিনের সাথে যোগাযোগ করুন অথবা হেল্প গাইড দেখুন
              </p>
            </div>

            {/* Mode Switcher: লাইভ চ্যাট ও হেল্প টপিকস */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-primary-main text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>লাইভ চ্যাট</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('topics')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'topics'
                    ? 'bg-primary-main text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>হেল্প টপিকস</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'chat' ? (
          /* Live Chat connected directly to Admin Support Inbox */
          <LiveSupportChatBox
            title="হেল্প সেন্টার লাইভ চ্যাট"
            subtitle="কাষ্টমার, ভেন্ডর ও রিসেলারদের সরাসরি এডমিন সাপোর্ট"
          />
        ) : (
          /* Help Topics */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="সমস্যা বা বিষয় অনুসন্ধান করুন..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:border-primary-main outline-none shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTopics.map((topic, i) => {
                const Icon = topic.icon;
                return (
                  <div
                    key={i}
                    onClick={() => setActiveTab('chat')}
                    className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-primary-main/40 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-primary-main flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-primary-main transition-colors">
                          {topic.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {topic.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-main group-hover:translate-x-0.5 transition-all" />
                  </div>
                );
              })}
            </div>

            {/* Quick banner to switch to Live Chat */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  নির্দিষ্ট উত্তর খুঁজে পাননি?
                </p>
                <p className="text-[11px] text-slate-600">
                  আমাদের এডমিন সাপোর্ট টিমের সাথে সরাসরি লাইভ চ্যাট করে তাৎক্ষণিক সমাধান পান।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="px-4 py-2 bg-primary-main hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>লাইভ চ্যাট শুরু করুন</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
