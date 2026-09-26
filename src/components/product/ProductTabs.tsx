import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from "react-router-dom";
import { FileText, List, Building2, Truck, RefreshCw, Star, MessageSquare } from 'lucide-react';
import ProductReviews from './ProductReviews';

interface ProductTabsProps {
  vendorId?: string;
  productId: string;
  description: string;
  specifications: Record<string, string>;
  vendor?: {
    name: string;
    rating: number;
    joined: string;
  };
}

export default function ProductTabs({ productId, description, specifications, vendor, vendorId }: ProductTabsProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('description');

  const tabs = [
    { id: 'description', label: 'Description', icon: FileText },
    { id: 'specifications', label: 'Specifications', icon: List },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare },
    { id: 'vendor', label: 'Vendor Info', icon: Building2 },
    { id: 'delivery', label: 'Delivery', icon: Truck },
    { id: 'returns', label: 'Return Policy', icon: RefreshCw },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex overflow-x-auto border-b border-gray-100 hide-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors relative ${
                isActive 
                  ? 'text-primary-main' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className={`h-4 w-4 ${isActive ? 'text-primary-main' : 'text-gray-400'}`} />
              {tab.label}
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-main"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'description' && (
              <div className="prose prose-sm sm:prose-base max-w-none text-gray-600">
                {description.split('\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-4">{paragraph}</p>
                ))}
              </div>
            )}

            {activeTab === 'specifications' && (
              <div className="overflow-hidden border border-gray-200 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200">
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(specifications || {}).map(([key, value], idx) => (
                      <tr key={key} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-3 px-6 text-sm font-medium text-gray-900 w-1/3">
                          {key}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-600">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'reviews' && (
              <ProductReviews productId={productId} />
            )}

            {activeTab === 'vendor' && (
              <div className="flex items-start gap-6">
                <div className="h-16 w-16 bg-primary-main/10 rounded-full flex items-center justify-center shrink-0">
                  <Building2 className="h-8 w-8 text-primary-main" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{vendor?.name || 'RJ WORLD BD Official'}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <span className="flex items-center"><Star className="h-4 w-4 text-yellow-400 fill-yellow-400 mr-1" /> {vendor?.rating || '4.9'} Rating</span>
                    <span>Joined {vendor?.joined || '2023'}</span>
                  </div>
                  <button onClick={() => navigate(`/store/${vendorId || "admin"}`)} className="px-4 py-2 border border-primary-main text-primary-main rounded-lg text-sm font-medium hover:bg-primary-main hover:text-white transition-colors">
                    Visit Store
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'delivery' && (
              <div className="space-y-4 text-gray-600 text-sm">
                <h4 className="font-semibold text-gray-900 text-base">Standard Delivery</h4>
                <p>Delivery in 3-5 business days. Free for orders over $100.</p>
                <h4 className="font-semibold text-gray-900 text-base mt-6">Express Delivery</h4>
                <p>Delivery in 1-2 business days. Additional $15 charge applies.</p>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg text-blue-800">
                  <p><strong>Note:</strong> Delivery times may vary depending on location and courier availability.</p>
                </div>
              </div>
            )}

            {activeTab === 'returns' && (
              <div className="space-y-4 text-gray-600 text-sm">
                <h4 className="font-semibold text-gray-900 text-base">30-Day Return Policy</h4>
                <p>If you are not satisfied with your purchase, you can return it within 30 days of receipt for a full refund or exchange.</p>
                <ul className="list-disc pl-5 space-y-2 mt-4">
                  <li>Items must be unused and in their original packaging.</li>
                  <li>Proof of purchase is required.</li>
                  <li>Return shipping costs are the responsibility of the customer unless the item is defective.</li>
                </ul>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
