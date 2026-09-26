const fs = require('fs');
const file = 'src/pages/vendor/VendorDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `{vendorInfo?.freeShopDomain && (
                        <div className="flex items-center gap-2 mt-1">
                          <a 
                            href={\`https://\${vendorInfo.freeShopDomain}\`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-sm font-medium text-primary-main hover:underline"
                          >
                            https://{vendorInfo.freeShopDomain}
                          </a>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              navigator.clipboard.writeText(\`https://\${vendorInfo.freeShopDomain}\`);
                              toast.success('Shop link copied!');
                            }}
                            className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      )}`;

const replacement = `{vendorInfo?.freeShopDomain && (
                        <div className="flex flex-col gap-1 mt-1">
                          <span className="text-sm text-gray-500">Free Shop Domain:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary-main">
                              https://{vendorInfo.freeShopDomain}/
                            </span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                navigator.clipboard.writeText(\`https://\${vendorInfo.freeShopDomain}/\`);
                                toast.success('Shop link copied!');
                              }}
                              className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors"
                            >
                              <Copy className="w-3 h-3" /> Copy
                            </button>
                            <a 
                              href={\`https://\${vendorInfo.freeShopDomain}/\`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs flex items-center gap-1 bg-primary-main hover:bg-sky-600 text-white px-2 py-1 rounded transition-colors"
                            >
                              Open Store
                            </a>
                          </div>
                        </div>
                      )}`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log("Updated VendorDashboard");
} else {
    console.log("Target not found in VendorDashboard");
}
