const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

if (!appContent.includes('AdminVerifiedSellers')) {
    appContent = appContent.replace(
        'import AdminResellers from "./pages/admin/AdminResellers";',
        'import AdminResellers from "./pages/admin/AdminResellers";\nimport AdminVerifiedSellers from "./pages/admin/AdminVerifiedSellers";'
    );
    appContent = appContent.replace(
        '<Route path="vendors" element={<AdminVendors />} />',
        '<Route path="vendors" element={<AdminVendors />} />\n            <Route path="verified-sellers" element={<AdminVerifiedSellers />} />'
    );
    fs.writeFileSync('src/App.tsx', appContent);
}

let layoutContent = fs.readFileSync('src/layouts/admin/AdminLayout.tsx', 'utf8');

if (!layoutContent.includes('verified-sellers')) {
    layoutContent = layoutContent.replace(
        "{ icon: Store, label: 'Vendors', path: '/admin/vendors' },",
        "{ icon: Store, label: 'Vendors', path: '/admin/vendors' },\n    { icon: BadgeCheck, label: 'Verified Sellers', path: '/admin/verified-sellers' },"
    );
    if(!layoutContent.includes('BadgeCheck')){
         layoutContent = layoutContent.replace(
            "import {",
            "import {\n  BadgeCheck,"
         )
    }
    fs.writeFileSync('src/layouts/admin/AdminLayout.tsx', layoutContent);
}

let contentConfig = fs.readFileSync('src/pages/admin/AdminContent.tsx', 'utf8');
if (!contentConfig.includes('Verified Sellers') && contentConfig.includes('Vendors')) {
    contentConfig = contentConfig.replace(
        "{ icon: Store, label: 'Vendors', path: '/admin/vendors' },",
        "{ icon: Store, label: 'Vendors', path: '/admin/vendors' },\n    { icon: BadgeCheck, label: 'Verified Sellers', path: '/admin/verified-sellers' },"
    );
    if(!contentConfig.includes('BadgeCheck')){
        contentConfig = contentConfig.replace(
           "import {",
           "import {\n  BadgeCheck,"
        )
    }
    fs.writeFileSync('src/pages/admin/AdminContent.tsx', contentConfig);
}
