const fs = require('fs');
const file = 'src/components/layout/Header.tsx';
let content = fs.readFileSync(file, 'utf8');

// logo size
content = content.replace('text-2xl font-bold', 'text-xl font-bold');
content = content.replace('w-[36px] h-[36px] md:w-[44px] md:h-[44px]', 'w-[28px] h-[28px] md:w-[36px] md:h-[36px]');

// mobile search padding
content = content.replace('pb-4', 'pb-2');

// header height
content = content.replace('h-16', 'h-12');

// mobile icons right side
content = content.replace('h-6 w-6', 'h-5 w-5'); // mostly applies to Heart, ShoppingCart, Menu, X
content = content.replace('h-6 w-6', 'h-5 w-5'); 
content = content.replace('h-6 w-6', 'h-5 w-5'); 
content = content.replace('h-6 w-6', 'h-5 w-5'); 

fs.writeFileSync(file, content);
console.log('Header made smaller');
