const fs = require('fs');
const file = 'src/pages/VendorApplication.tsx';
let content = fs.readFileSync(file, 'utf8');

// Container padding
content = content.replace('py-12 px-4 sm:px-6', 'py-6 px-4 sm:px-6');
content = content.replace('mb-10', 'mb-6');
content = content.replace('p-8', 'p-5 sm:p-6');
content = content.replace('space-y-6', 'space-y-4 sm:space-y-5');
content = content.replace(/space-y-4/g, 'space-y-3 sm:space-y-4');

// Header
content = content.replace('text-3xl font-bold', 'text-xl sm:text-2xl font-bold');
content = content.replace('mb-4 tracking-tight', 'mb-2 tracking-tight');

// Titles
content = content.replace(/text-lg font-semibold/g, 'text-base font-semibold');

// Inputs
content = content.replace(/px-4 py-2/g, 'px-3 py-2 sm:px-4 sm:py-2 text-sm');
content = content.replace(/h-5 w-5/g, 'h-4 w-4 sm:h-5 sm:w-5');
content = content.replace(/pl-10/g, 'pl-9 sm:pl-10');
content = content.replace(/pl-3/g, 'pl-2.5 sm:pl-3');

// Button
content = content.replace('py-3 px-4 text-lg', 'py-2 px-3 sm:py-3 sm:px-4 text-sm sm:text-base');
content = content.replace('py-3 px-4', 'py-2 px-3 sm:py-3 sm:px-4 text-sm sm:text-base');

fs.writeFileSync(file, content);
console.log('VendorApplication made smaller');
