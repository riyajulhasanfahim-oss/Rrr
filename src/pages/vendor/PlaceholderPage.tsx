import React from 'react';
import VendorLayout from '../../components/layout/VendorLayout';
import { Layers } from 'lucide-react';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <VendorLayout>
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm text-center max-w-lg mx-auto my-4 sm:my-8">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-primary-main flex items-center justify-center mx-auto mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-1.5">{title}</h2>
        <p className="text-xs sm:text-sm text-gray-500">
          This feature is currently being tuned and will be available soon.
        </p>
      </div>
    </VendorLayout>
  );
}

