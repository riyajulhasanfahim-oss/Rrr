const fs = require('fs');
let content = fs.readFileSync('src/pages/VendorStore.tsx', 'utf8');

content = content.replace(
    ") : (\n                            {/* Search and Filters */}\n          {activeTab === 'products' && (",
    ") : (\n                  <div>\n          {/* Search and Filters */}\n          {activeTab === 'products' && ("
);

content = content.replace(
    ")}\n              </div>\n            )}\n\n            {activeTab === 'policies' && (",
    ")}\n                  </div>\n                )}\n              </div>\n            )}\n\n            {activeTab === 'policies' && ("
);


fs.writeFileSync('src/pages/VendorStore.tsx', content);
