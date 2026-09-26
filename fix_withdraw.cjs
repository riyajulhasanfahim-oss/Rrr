const fs = require('fs');
const file = 'src/pages/profile/WithdrawPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Container
content = content.replace('pt-8 pb-16 px-4 md:px-8', 'pt-4 pb-12 px-4 md:px-6');
content = content.replace('mb-6', 'mb-4'); // For back button and locked bonus
content = content.replace('p-6 md:p-8', 'p-4 md:p-6');
content = content.replace('mb-8 pb-6', 'mb-6 pb-4');
content = content.replace('text-2xl font-bold', 'text-xl font-bold');
content = content.replace('text-2xl font-bold', 'text-xl font-bold');

// Locked Bonus Banner
content = content.replace('p-4 flex items-start gap-3', 'p-3 flex items-start gap-2');
content = content.replace('w-5 h-5 text-amber-500', 'w-4 h-4 text-amber-500 mt-0.5');

// Methods
content = content.replace('space-y-6', 'space-y-4');
content = content.replace('mb-4', 'mb-2 sm:mb-3');
content = content.replace('grid-cols-1 md:grid-cols-3 gap-4', 'grid-cols-3 gap-2 sm:gap-3');
content = content.replace('p-4 border-2 transition-all duration-200 flex flex-col items-center gap-3', 'p-3 border-2 transition-all duration-200 flex flex-col items-center gap-2');
content = content.replace('w-12 h-12 rounded-full', 'w-10 h-10 rounded-full');
content = content.replace('w-6 h-6', 'w-5 h-5');
content = content.replace('font-bold', 'text-xs sm:text-sm font-bold');

// Inputs
content = content.replace('mb-2', 'mb-1 sm:mb-2');
content = content.replace('mb-2', 'mb-1 sm:mb-2'); // second label
content = content.replace('px-4 py-3 rounded-xl', 'px-3 py-2 rounded-xl text-sm');
content = content.replace('left-4', 'left-3');
content = content.replace('pl-10 pr-4 py-3 rounded-xl', 'pl-8 pr-3 py-2 rounded-xl text-base');
content = content.replace('text-lg font-bold', 'text-base font-bold');
content = content.replace('w-4 h-4', 'w-3.5 h-3.5');

// Button
content = content.replace('py-4 rounded-xl font-bold text-lg', 'py-3 rounded-xl font-bold text-base');

fs.writeFileSync(file, content);
console.log('Profile WithdrawPage made smaller');
