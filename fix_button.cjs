const fs = require('fs');
const file = 'src/components/home/BrandList.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'className="w-full py-2.5 bg-primary-main',
  'className="w-full py-1.5 sm:py-2 bg-primary-main'
);

fs.writeFileSync(file, content);
console.log('Button made thinner');
