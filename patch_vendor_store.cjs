const fs = require('fs');
let content = fs.readFileSync('src/pages/VendorStore.tsx', 'utf8');

if (content.includes('profile?.verificationBadge')) {
    content = content.replace(
        "{profile?.verificationBadge && (",
        "{vendor?.verificationStatus === 'verified' && ("
    );
    
    // Make sure we have BadgeCheck
    if(!content.includes('BadgeCheck') && !content.includes('Verified')) {
       // Just leaving it as CheckCircle2 or use BadgeCheck
       content = content.replace(
          "<CheckCircle2 className=\"w-6 h-6 text-blue-500\" />",
          "<BadgeCheck className=\"w-6 h-6 text-blue-500\" />"
       );
       content = content.replace("CheckCircle2, ", "BadgeCheck, CheckCircle2, ");
    }
}

// Add Search bar (as per requirements)
if (!content.includes('Search products')) {
    const searchBar = `
          {/* Search and Filters */}
          {activeTab === 'products' && (
            <div className="mb-6 flex gap-4">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Search products in this store..." 
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2`;
    
    content = content.replace(
        '<div className="grid grid-cols-2',
        searchBar
    );
}

// Update the Policies tab
if (!content.includes("'policies'")) {
    content = content.replace(
        "['products', 'about', 'reviews']",
        "['products', 'about', 'reviews', 'policies']"
    );
    
    const policiesTabContent = `
            {activeTab === 'policies' && (
              <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Store Policies</h3>
                <div className="space-y-8">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Shipping Policy</h4>
                    <p className="text-gray-600 leading-relaxed">{profile?.policies?.shipping || 'Orders are typically processed within 1-2 business days. Shipping times vary depending on the destination.'}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Return & Refund Policy</h4>
                    <p className="text-gray-600 leading-relaxed">{profile?.policies?.returns || 'We accept returns within 7 days of delivery. Items must be in original condition with tags attached. Refunds are processed to the original payment method.'}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Privacy Policy</h4>
                    <p className="text-gray-600 leading-relaxed">We value your privacy and handle your data in accordance with platform guidelines. Your information is only used for order fulfillment and communication regarding your purchase.</p>
                  </div>
                </div>
              </div>
            )}
`;
    content = content.replace(
        "{activeTab === 'about' && (",
        policiesTabContent + "\n            {activeTab === 'about' && ("
    );
}

fs.writeFileSync('src/pages/VendorStore.tsx', content);
