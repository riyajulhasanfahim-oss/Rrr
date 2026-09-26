import React from 'react';
import { Store, ArrowLeft } from 'lucide-react';

export default function ShopNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Store className="w-10 h-10 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Shop Not Found</h1>
        <p className="text-gray-500 mb-8">
          The shop you are looking for does not exist or has been removed.
        </p>
        <a
          href="https://rjworldbd.com"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-main text-white font-medium rounded-lg hover:bg-sky-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go to RJ WORLD BD Marketplace
        </a>
      </div>
    </div>
  );
}
