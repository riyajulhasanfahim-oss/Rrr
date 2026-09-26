const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
const importTarget = `import ShopDomainWrapper from "./components/ShopDomainWrapper";`;
const importReplacement = `import ShopDomainWrapper from "./components/ShopDomainWrapper";\nimport RootRoute from "./components/RootRoute";`;
content = content.replace(importTarget, importReplacement);

// Replace route
const routeTarget = `<Route path="/" element={<Home />} />`;
const routeReplacement = `<Route path="/" element={<RootRoute />} />`;
content = content.replace(routeTarget, routeReplacement);

fs.writeFileSync(file, content);
