const fs = require('fs');
const file = 'src/components/ui/ProductCard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('p-2 flex flex-col', 'p-1.5 flex flex-col');
content = content.replace('text-xs sm:text-sm', 'text-[11px] sm:text-xs');
content = content.replace(/text-sm sm:text-base/g, 'text-[11px] sm:text-sm');
content = content.replace(/h-7 w-7 sm:h-8 sm:w-8/g, 'h-6 w-6 sm:h-7 sm:w-7');
content = content.replace(/h-3.5 w-3.5/g, 'h-3 w-3');

fs.writeFileSync(file, content);
console.log('ProductCard made smaller');
