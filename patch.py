with open("src/pages/vendor/VendorDashboard.tsx", "r") as f:
    content = f.read()

content = content.replace("const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);", 
"""const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);""")

content = content.replace("toast.success('Verification request submitted successfully!');", 
"setIsSuccessModalOpen(true);")

modal_code = """      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl relative text-center">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Request Submitted</h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 mb-4">
              <Clock className="w-4 h-4" /> Pending
            </div>
            <p className="text-gray-600 mb-8">Please wait up to 12 hours for Admin approval.</p>
            <button 
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </VendorLayout>"""

content = content.replace("    </VendorLayout>", modal_code)

with open("src/pages/vendor/VendorDashboard.tsx", "w") as f:
    f.write(content)
