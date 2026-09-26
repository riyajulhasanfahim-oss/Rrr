const fs = require('fs');
let content = fs.readFileSync('src/pages/VendorStore.tsx', 'utf8');

// I will find the exact string that needs replacement
const badString = `                ) : (
                            {/* Search and Filters */}
          {activeTab === 'products' && (`;
          
if(content.includes(badString)) {
    content = content.replace(badString, `                ) : (
                  <div>
          {/* Search and Filters */}
          {activeTab === 'products' && (`);
}

const badEndString = `                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'policies' && (`;

if(content.includes(badEndString)) {
    content = content.replace(badEndString, `                    ))}
                  </div>
                )}
                </div>
              </div>
            )}

            {activeTab === 'policies' && (`);
}

fs.writeFileSync('src/pages/VendorStore.tsx', content);
