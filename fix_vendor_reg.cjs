const fs = require('fs');
const file = 'src/pages/vendor/auth/VendorRegistration.tsx';
let content = fs.readFileSync(file, 'utf8');

// Container padding
content = content.replace('pt-12 pb-16 px-6', 'pt-6 pb-10 px-4');
content = content.replace('p-6 shadow-xl', 'p-4 shadow-xl');
content = content.replace('space-y-5', 'space-y-4');
content = content.replace('mt-6', 'mt-4');

// Header
content = content.replace('w-16 h-16', 'w-12 h-12');
content = content.replace('w-8 h-8', 'w-6 h-6');
content = content.replace('text-2xl font-bold', 'text-xl sm:text-2xl font-bold');
content = content.replace('mb-4 border', 'mb-2 border');
content = content.replace('mt-2 text-sm', 'mt-1 text-xs sm:text-sm');

// Titles
content = content.replace(/text-lg font-bold/g, 'text-base font-bold');
content = content.replace(/mb-4/g, 'mb-2 sm:mb-3');
content = content.replace(/mb-1.5/g, 'mb-1');

// Inputs
content = content.replace(/px-4 py-3/g, 'px-3 py-2 sm:px-4 sm:py-3 text-sm');
content = content.replace(/w-5 h-5/g, 'w-4 h-4 sm:w-5 sm:h-5');
content = content.replace(/gap-4/g, 'gap-3 sm:gap-4');
content = content.replace('pr-12', 'pr-10');
content = content.replace('right-3', 'right-2.5 sm:right-3');

// Button
content = content.replace('py-4 bg-slate-900', 'py-3 bg-slate-900 text-sm');

fs.writeFileSync(file, content);
console.log('VendorRegistration made smaller');
