const fs = require('fs');
const file = 'src/pages/vendor/profile/ShopProfile.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `                      <a href={\`https://\${profile.freeShopDomain}\`} target="_blank" rel="noreferrer" className="underline">\`https://\${profile.freeShopDomain}\`</a>`;
const replacement = `                      <a href={\`https://\${profile.freeShopDomain}/\`} target="_blank" rel="noreferrer" className="underline">https://{profile.freeShopDomain}/</a>`;

content = content.replace(target, replacement);

const targetCopy = `navigator.clipboard.writeText(\`https://\${profile.freeShopDomain}\`);`;
const replacementCopy = `navigator.clipboard.writeText(\`https://\${profile.freeShopDomain}/\`);`;

content = content.replace(targetCopy, replacementCopy);

fs.writeFileSync(file, content);
