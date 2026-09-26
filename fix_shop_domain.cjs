const fs = require('fs');
const file = 'src/components/ShopDomainWrapper.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "hostname.includes('webcontainer.io');",
  "hostname.includes('webcontainer.io') ||\n        hostname.includes('vercel.app');"
);

fs.writeFileSync(file, content);
