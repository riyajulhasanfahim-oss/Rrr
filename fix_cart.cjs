const fs = require('fs');
const file = 'src/pages/CartPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Main layout
content = content.replace('pt-8 pb-16', 'pt-4 pb-12');
content = content.replace('mb-8', 'mb-4 sm:mb-6');
content = content.replace('text-3xl font-bold text-gray-900', 'text-xl sm:text-2xl font-bold text-gray-900');
content = content.replace('gap-8 items-start', 'gap-4 sm:gap-6 items-start');
content = content.replace('lg:col-span-2 space-y-4', 'lg:col-span-2 space-y-3 sm:space-y-4');

// Empty State
content = content.replace('p-12 text-center', 'p-6 sm:p-12 text-center');
content = content.replace('w-24 h-24 bg-gray-50', 'w-16 h-16 sm:w-24 sm:h-24 bg-gray-50');
content = content.replace('h-10 w-10 text-gray-400', 'h-8 w-8 sm:h-10 sm:w-10 text-gray-400');
content = content.replace('mb-6', 'mb-4 sm:mb-6');
content = content.replace('px-8 py-3 bg-primary-main', 'px-6 py-2.5 sm:px-8 sm:py-3 bg-primary-main text-sm sm:text-base');

// Select all 
content = content.replace('p-4 shadow-sm border border-gray-100 flex items-center justify-between', 'p-3 sm:p-4 shadow-sm border border-gray-100 flex items-center justify-between');

// Cart item
content = content.replace('p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 overflow-hidden', 'p-3 sm:p-4 shadow-sm border border-gray-100 flex flex-row gap-3 sm:gap-4 overflow-hidden');
content = content.replace('flex items-start gap-3', 'flex items-start gap-2 sm:gap-3');
content = content.replace('mt-2 text-primary-main', 'mt-0 sm:mt-2 text-primary-main self-start sm:self-auto');
content = content.replace('w-24 h-24 rounded-lg overflow-hidden bg-gray-50 border border-gray-100', 'w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100');
content = content.replace('mt-4', 'mt-2 sm:mt-4');

// Item Title & Price
content = content.replace('text-sm font-semibold text-gray-900', 'text-xs sm:text-sm font-semibold text-gray-900');
content = content.replace('text-base font-bold text-gray-900', 'text-sm sm:text-base font-bold text-gray-900');
content = content.replace('text-xs text-gray-500 line-through', 'text-[10px] sm:text-xs text-gray-500 line-through');
content = content.replace('gap-4', 'gap-2 sm:gap-4'); // Might apply to a few places, which is fine
content = content.replace('gap-3', 'gap-2 sm:gap-3');

// Mobile fixed footer
content = content.replace('p-4 flex flex-col gap-3', 'p-3 sm:p-4 flex flex-col gap-2');
content = content.replace('text-lg font-bold text-primary-main', 'text-base sm:text-lg font-bold text-primary-main');
content = content.replace('py-3.5 bg-primary-main', 'py-2.5 bg-primary-main text-sm sm:text-base');

// Checkbox sizes
content = content.replace(/h-5 w-5/g, 'h-4 w-4 sm:h-5 sm:w-5');

fs.writeFileSync(file, content);
console.log('CartPage made smaller');
