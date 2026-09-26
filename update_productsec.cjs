const fs = require('fs');
const file = 'src/components/home/ProductSection.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('py-3 sm:py-4', 'py-2 sm:py-3');
content = content.replace('mb-3 sm:mb-4', 'mb-2 sm:mb-3');
content = content.replace('text-base sm:text-lg', 'text-sm sm:text-base');
content = content.replace('gap-2 sm:gap-4', 'gap-1.5 sm:gap-3');
content = content.replace('text-xs sm:text-sm', 'text-[10px] sm:text-xs');

fs.writeFileSync(file, content);
console.log('ProductSection made smaller');
