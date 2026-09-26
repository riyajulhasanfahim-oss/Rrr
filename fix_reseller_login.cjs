const fs = require('fs');
const file = 'src/pages/reseller/auth/ResellerLogin.tsx';
let content = fs.readFileSync(file, 'utf8');

// Container
content = content.replace('p-8 sm:p-12', 'p-4 sm:p-8');
content = content.replace('space-y-6', 'space-y-4');
content = content.replace('space-y-4', 'space-y-3 sm:space-y-4');
content = content.replace('mb-8', 'mb-4 sm:mb-6');
content = content.replace('pt-12 pb-24 px-4', 'pt-6 pb-20 px-4');

// Header
content = content.replace('text-3xl font-bold', 'text-xl sm:text-2xl font-bold');
content = content.replace('w-16 h-16', 'w-12 h-12');
content = content.replace('w-8 h-8', 'w-6 h-6');

// Inputs
content = content.replace(/px-4 py-3/g, 'px-3 py-2 sm:px-4 sm:py-3 text-sm');
content = content.replace(/h-5 w-5/g, 'h-4 w-4');
content = content.replace(/pl-11/g, 'pl-9 sm:pl-11');
content = content.replace(/pl-4/g, 'pl-3 sm:pl-4');

// Button
content = content.replace('py-3 px-4 text-lg', 'py-2 px-3 sm:py-3 sm:px-4 text-base');

fs.writeFileSync(file, content);
console.log('ResellerLogin made smaller');
