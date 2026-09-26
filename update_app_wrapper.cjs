const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const importTarget = `import ResellerShopManagement from "./pages/reseller/shop/ResellerShopManagement";`;
const importReplacement = `import ResellerShopManagement from "./pages/reseller/shop/ResellerShopManagement";\nimport ShopDomainWrapper from "./components/ShopDomainWrapper";`;

content = content.replace(importTarget, importReplacement);

const routerTarget = `<Router>
            <Toaster position="top-right" />
          <Routes>`;
const routerReplacement = `<Router>
            <Toaster position="top-right" />
          <ShopDomainWrapper>
          <Routes>`;

content = content.replace(routerTarget, routerReplacement);

const routerEndTarget = `</Routes>
        <BottomNavigation />
      </Router>`;
const routerEndReplacement = `</Routes>
          </ShopDomainWrapper>
        <BottomNavigation />
      </Router>`;

content = content.replace(routerEndTarget, routerEndReplacement);

fs.writeFileSync(file, content);
