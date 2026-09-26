const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminResellers.tsx', 'utf8');

content = content.replace(
/className={\`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold \\\$\{selectedReseller\.status === 'active' \? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'\}\`}>[\s\S]*?<\/span>/,
`className={\`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold \${selectedReseller.status === 'active' ? 'bg-emerald-100 text-emerald-700' : selectedReseller.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}\`}>
                    {selectedReseller.status === 'active' ? 'Active Account' : selectedReseller.status === 'pending' ? 'Pending Approval' : 'Suspended Account'}
                  </span>`
);

content = content.replace(
/<h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">/,
`{selectedReseller.status === 'pending' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-amber-900 mb-3">Registration Payment</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-amber-700 uppercase tracking-wider font-semibold">Amount</p>
                      <p className="font-medium text-amber-900 font-mono">৳{selectedReseller.registrationFee || 390}</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-700 uppercase tracking-wider font-semibold">Method</p>
                      <p className="font-medium text-amber-900">{selectedReseller.paymentMethod || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-amber-700 uppercase tracking-wider font-semibold">Transaction ID</p>
                      <p className="font-medium text-amber-900 font-mono">{selectedReseller.transactionId || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                     <button
                        onClick={() => {
                            approveReseller(selectedReseller.id);
                            setSelectedReseller(null);
                        }}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors"
                     >
                       Approve Application
                     </button>
                  </div>
                </div>
              )}

              <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">`
);

fs.writeFileSync('src/pages/admin/AdminResellers.tsx', content);
