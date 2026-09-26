const fs = require('fs');
let content = fs.readFileSync('src/pages/vendor/VendorDashboard.tsx', 'utf8');

if (!content.includes('isVerifyModalOpen')) {
    content = content.replace(
        "const [loading, setLoading] = useState(true);",
        "const [loading, setLoading] = useState(true);\n  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);\n  const [isVerifying, setIsVerifying] = useState(false);"
    );
}

// Add the verification request handler
if (!content.includes('handleRequestVerification')) {
    content = content.replace(
        "return (",
        `
  const handleRequestVerification = async () => {
    if (!user) return;
    setIsVerifying(true);
    try {
      // 1. Create a verification request
      await addDoc(collection(db, 'verified_seller_requests'), {
        vendorId: user.uid,
        sellerName: userData?.name || vendorInfo?.ownerName || 'Unknown',
        storeName: vendorInfo?.shopName || 'Unknown',
        paymentAmount: 100,
        paymentStatus: 'completed',
        status: 'pending',
        requestDate: serverTimestamp()
      });
      
      // 2. Update vendor status
      await updateDoc(doc(db, 'vendors', user.uid), {
        verificationStatus: 'pending'
      });
      
      setVendorInfo(prev => ({...prev, verificationStatus: 'pending'}));
      setIsVerifyModalOpen(false);
      toast.success('Verification request submitted successfully!');
    } catch (error) {
      console.error("Error submitting verification request:", error);
      toast.error('Failed to submit verification request.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (`
    );
}

// Add the verification card next to the Add Product button
if (!content.includes('verificationStatus')) {
    content = content.replace(
        `<div className="flex gap-3">`,
        `<div className="flex flex-col sm:flex-row gap-3">
          {(!vendorInfo?.verificationStatus || vendorInfo?.verificationStatus === 'not_verified' || vendorInfo?.verificationStatus === 'rejected') && (
            <button 
              onClick={() => setIsVerifyModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all flex items-center justify-center gap-2"
            >
              <BadgeCheck className="w-4 h-4" />
              Get Verified - ৳100
            </button>
          )}
          {vendorInfo?.verificationStatus === 'pending' && (
            <div className="px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 text-sm font-medium rounded-lg flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Verification Pending
            </div>
          )}
          {vendorInfo?.verificationStatus === 'verified' && (
            <div className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 text-sm font-medium rounded-lg flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Verified Seller
            </div>
          )}
`
    );
}

// Add the modal itself
if (!content.includes('VerificationModal')) {
    content = content.replace(
        "</VendorLayout>",
        `
      {/* Verification Modal */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <button 
              onClick={() => setIsVerifyModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                <BadgeCheck className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verified Seller Plan</h2>
              <p className="text-gray-500">Upgrade your store to build trust and increase sales.</p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-gray-700">Plan Price</span>
                <span className="text-xl font-bold text-blue-600">৳100</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Verified Seller badge on your profile</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Display as a trusted seller to customers</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Priority store visibility</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setIsVerifyModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleRequestVerification}
                disabled={isVerifying}
                className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? 'Processing...' : 'Pay & Verify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </VendorLayout>`
    );
}

fs.writeFileSync('src/pages/vendor/VendorDashboard.tsx', content);
