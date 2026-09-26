const fs = require('fs');
const file = 'src/pages/vendor/profile/ShopProfile.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add the Tab button
const tabsTarget = `        <button
          onClick={() => setActiveTab('customization')}
          className={\`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors \${
            activeTab === 'customization'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-gray-500 hover  '
          }\`}
        >
          <Palette className="w-4 h-4" />
          Store Customization
        </button>
      </div>`;

const tabsReplacement = `        <button
          onClick={() => setActiveTab('customization')}
          className={\`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors \${
            activeTab === 'customization'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-gray-500 hover  '
          }\`}
        >
          <Palette className="w-4 h-4" />
          Store Customization
        </button>
        <button
          onClick={() => setActiveTab('domain')}
          className={\`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors \${
            activeTab === 'domain'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-gray-500 hover  '
          }\`}
        >
          <Globe2 className="w-4 h-4" />
          Shop Domain
        </button>
      </div>`;

content = content.replace(tabsTarget, tabsReplacement);

// Add the Domain Content Block
const contentTarget = `        {/* Store Customization Tab */}`;

const contentReplacement = `        {/* Shop Domain Tab */}
        {activeTab === 'domain' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Free RJ World Shop Domain</h2>
                  <p className="text-sm text-gray-500">Get a free unique domain for your shop</p>
                </div>
                <Globe className="w-8 h-8 text-primary-main opacity-20" />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                  <div className="flex-grow">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Free Domain</label>
                    <div className="flex items-center bg-gray-50 border border-gray-300 rounded-lg px-4 py-2">
                      <Link className="w-4 h-4 text-gray-400 mr-2" />
                      <input
                        type="text"
                        readOnly
                        value={profile.freeShopDomain || 'Not generated yet'}
                        className="bg-transparent flex-grow outline-none text-gray-700 font-medium"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateFreeDomain}
                    disabled={verifyingDomain}
                    className="px-6 py-2 bg-primary-main text-white font-medium rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 h-[42px] whitespace-nowrap"
                  >
                    {verifyingDomain ? 'Generating...' : (profile.freeShopDomain ? 'Regenerate Domain' : 'Generate Free Domain')}
                  </button>
                </div>
                {profile.freeShopDomain && (
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Active: <a href={\`https://\${profile.freeShopDomain}\`} target="_blank" rel="noreferrer" className="underline">{profile.freeShopDomain}</a>
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Custom Domain</h2>
                  <p className="text-sm text-gray-500">Connect your own domain (e.g., www.myshop.com)</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                  <div className="flex-grow">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom Domain URL</label>
                    <input
                      type="text"
                      value={profile.customDomain || ''}
                      onChange={(e) => setProfile((prev: any) => ({ ...prev, customDomain: e.target.value, customDomainStatus: 'Pending', verificationStatus: 'Pending' }))}
                      placeholder="www.myshop.com"
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-primary-main text-gray-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyCustomDomain}
                    disabled={verifyingDomain || !profile.customDomain}
                    className="px-6 py-2 border border-primary-main text-primary-main font-medium rounded-lg hover:bg-sky-50 transition-colors disabled:opacity-50 h-[42px] whitespace-nowrap"
                  >
                    {verifyingDomain ? 'Verifying...' : 'Verify Domain'}
                  </button>
                </div>
                
                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-2">DNS Configuration</h3>
                  <p className="text-sm text-slate-600 mb-4">Please add the following CNAME record to your domain provider's DNS settings before verifying.</p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-100 rounded-t-lg">
                        <tr>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Host/Name</th>
                          <th className="px-4 py-2">Value/Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white border-b">
                          <td className="px-4 py-2 font-medium">CNAME</td>
                          <td className="px-4 py-2">www <span className="text-xs text-gray-400">(or @)</span></td>
                          <td className="px-4 py-2 font-mono text-primary-main">shops.rjworld.com</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between p-3 rounded-lg border bg-white">
                  <div className="flex items-center gap-3">
                    <div className={\`w-2 h-2 rounded-full \${profile.verificationStatus === 'Verified' ? 'bg-green-500' : 'bg-amber-500'}\`}></div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Status: {profile.verificationStatus || 'Pending'}</p>
                      <p className="text-xs text-gray-500">
                        {profile.verificationStatus === 'Verified' ? 'Domain is active and ready to use.' : 'Waiting for DNS verification. Changes may take up to 24 hours.'}
                      </p>
                    </div>
                  </div>
                  {profile.verificationStatus === 'Verified' && (
                    <button 
                      type="button" 
                      onClick={() => setProfile((prev: any) => ({ ...prev, customDomain: '', customDomainStatus: 'Pending', verificationStatus: 'Pending' }))}
                      className="text-red-500 text-sm font-medium hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-primary-main text-white font-medium rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Profile</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Store Customization Tab */}`;

content = content.replace(contentTarget, contentReplacement);

fs.writeFileSync(file, content);
