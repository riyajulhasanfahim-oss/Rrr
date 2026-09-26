const fs = require('fs');
const file = 'src/components/ShopDomainWrapper.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "hostname.includes('vercel.app');",
  "hostname.includes('vercel.app') ||\n        hostname.includes('netlify.app');"
);

fs.writeFileSync(file, content);
console.log('Updated ShopDomainWrapper for Netlify');
