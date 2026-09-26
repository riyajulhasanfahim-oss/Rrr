const fs = require('fs');
const file = 'src/pages/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Padding of panels
content = content.replace(/p-6/g, 'p-4 md:p-5');

// Top header padding
content = content.replace('px-4 md:px-8 pt-8 pb-6', 'px-4 pt-6 pb-4 md:px-6 md:pt-8 md:pb-6');
content = content.replace('px-4 md:px-8 py-6', 'px-4 py-4 md:px-6 md:py-6');
content = content.replace('h-24 w-24 rounded-full', 'h-16 w-16 md:h-20 md:w-20 rounded-full');
content = content.replace('h-24 w-24 rounded-full', 'h-16 w-16 md:h-20 md:w-20 rounded-full');
content = content.replace('text-3xl font-bold', 'text-2xl md:text-3xl font-bold');
content = content.replace('text-2xl font-bold text-slate-900', 'text-xl md:text-2xl font-bold text-slate-900');
content = content.replace('gap-6 mt-2', 'gap-4 mt-2');
content = content.replace('px-4 py-1.5', 'px-3 py-1');

// Orders
content = content.replace('w-12 h-12 md:w-14 md:h-14', 'w-10 h-10 md:w-12 md:h-12');
content = content.replace('w-6 h-6 md:w-7 md:h-7', 'w-5 h-5 md:w-6 md:h-6');
content = content.replace('gap-y-6 gap-x-2', 'gap-y-4 gap-x-2');
content = content.replace('w-12 h-12 md:w-14 md:h-14', 'w-10 h-10 md:w-12 md:h-12');
content = content.replace('w-6 h-6 md:w-7 md:h-7', 'w-5 h-5 md:w-6 md:h-6');

// List items
content = content.replace(/p-5 hover:bg-slate-50/g, 'p-3.5 hover:bg-slate-50 md:p-4');
content = content.replace('text-sm md:text-base font-medium', 'text-sm font-medium');
content = content.replace('text-sm md:text-base font-medium', 'text-sm font-medium'); // for logout too
content = content.replace(/w-5 h-5 text-slate-400/g, 'w-4 h-4 text-slate-400');
content = content.replace(/w-5 h-5 text-slate-300/g, 'w-4 h-4 text-slate-300');
content = content.replace('w-5 h-5 text-red-200', 'w-4 h-4 text-red-200');
content = content.replace('w-5 h-5', 'w-4 h-4'); // for Logout icon

// Typography titles
content = content.replace(/text-lg/g, 'text-base md:text-lg');
content = content.replace(/mb-6/g, 'mb-4');

fs.writeFileSync(file, content);
console.log('Dashboard made smaller');
