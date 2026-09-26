const fs = require('fs');
const file = 'src/components/home/Categories.tsx';
let content = fs.readFileSync(file, 'utf8');

// padding
content = content.replace('pt-3 sm:pt-4 pb-2', 'pt-2 sm:pt-3 pb-1');

// title size
content = content.replace('text-base sm:text-lg', 'text-sm sm:text-base');
content = content.replace('mb-3', 'mb-2');

// flex container width
content = content.replace('w-[70px] sm:w-[80px]', 'w-[64px] sm:w-[76px]');
content = content.replace('gap-2 sm:gap-3', 'gap-1.5 sm:gap-2.5');

// image block
content = content.replace('h-14 w-14 sm:h-16 sm:w-16', 'h-12 w-12 sm:h-14 sm:w-14');

// text block
content = content.replace('text-[10px] sm:text-xs', 'text-[9px] sm:text-[10px]');

fs.writeFileSync(file, content);
console.log('Categories made smaller');
