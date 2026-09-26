import React from 'react';
export default function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 min-h-[400px] flex items-center justify-center">
        <p className="text-gray-500">{title} Management module coming soon.</p>
      </div>
    </div>
  );
}
