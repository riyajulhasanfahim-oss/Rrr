const fs = require('fs');
const file = 'src/components/home/BrandList.tsx';
let content = fs.readFileSync(file, 'utf8');

// padding
content = content.replace('py-2 sm:py-3', 'py-1.5 sm:py-2');

// title size
content = content.replace('text-base sm:text-lg', 'text-sm sm:text-base');
content = content.replace('mb-2', 'mb-1.5');

// container width
content = content.replace('w-[72px] sm:w-[84px]', 'w-[64px] sm:w-[76px]');
content = content.replace('gap-2 sm:gap-3', 'gap-1.5 sm:gap-2.5');

// image block
content = content.replace('w-9 h-9 sm:w-11 sm:h-11', 'w-8 h-8 sm:w-10 sm:h-10');

// font size
content = content.replace('text-[8.5px] sm:text-[9px]', 'text-[8px] sm:text-[9px]');

// button
content = content.replace('text-[8px] sm:text-[8.5px]', 'text-[7.5px] sm:text-[8px]');
content = content.replace('py-0.5', 'py-[1px]');

fs.writeFileSync(file, content);
console.log('BrandList made smaller');
