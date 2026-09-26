const fs = require('fs');
let content = fs.readFileSync('src/pages/ResellerApplication.tsx', 'utf8');

content = content.replace(
/if \(data\.status === 'pending'\) {[\s\S]*?navigate\('\/'\);\n          }/,
`if (data.status === 'pending') {
            setStep(3);
          }`
);

// We need to also change step 3 text to include approval status
content = content.replace(
/<h2 className="text-2xl font-bold text-slate-900">Application Submitted!<\/h2>[\s\S]*?We have received your reseller registration and payment details\.[\s\S]*?Our team will verify the payment and approve your account shortly\.[\s\S]*?<\/p>/,
`<h2 className="text-2xl font-bold text-slate-900">Application Pending Approval</h2>
                  <p className="text-slate-600 mt-2">
                    We have received your reseller registration and payment details (৳390). 
                    Our team will verify the payment and approve your account shortly.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-sm font-bold border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Status: Pending Verification
                  </div>`
);

fs.writeFileSync('src/pages/ResellerApplication.tsx', content);
