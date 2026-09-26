const fs = require('fs');
const file = 'src/pages/ResellerApplication.tsx';
let content = fs.readFileSync(file, 'utf8');

// Container padding
content = content.replace('pt-8 px-4', 'pt-4 px-2 sm:px-4');
content = content.replace('mb-8', 'mb-4');
content = content.replace('p-8', 'p-4 sm:p-6');
content = content.replace('space-y-6', 'space-y-4 sm:space-y-5');
content = content.replace('space-y-4', 'space-y-3 sm:space-y-4');

// Header
content = content.replace('w-16 h-16', 'w-12 h-12');
content = content.replace('w-8 h-8', 'w-6 h-6');
content = content.replace('text-3xl font-bold', 'text-xl sm:text-2xl font-bold');

// Titles
content = content.replace('text-lg font-semibold', 'text-base font-semibold');

// Inputs
content = content.replace(/px-4 py-2/g, 'px-3 py-1.5 sm:px-4 sm:py-2 text-sm');
content = content.replace(/h-5 w-5/g, 'h-4 w-4');
content = content.replace(/pl-10/g, 'pl-9 sm:pl-10');
content = content.replace(/pl-3/g, 'pl-2.5 sm:pl-3');

// Other padding
content = content.replace('p-6 bg-slate-50', 'p-4 bg-slate-50');
content = content.replace('px-6 py-4', 'px-4 py-3 sm:px-6 sm:py-4');
content = content.replace('py-3 px-4', 'py-2 px-3 sm:py-3 sm:px-4 text-sm');
content = content.replace('gap-4', 'gap-3 sm:gap-4');

fs.writeFileSync(file, content);
console.log('ResellerApplication made smaller');
