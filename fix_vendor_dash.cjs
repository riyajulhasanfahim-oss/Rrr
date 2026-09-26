const fs = require('fs');
const file = 'src/pages/vendor/VendorDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Vendor Profile header section
content = content.replace('h-32 md:h-48', 'h-24 md:h-32');
content = content.replace('px-6 pb-6', 'px-4 pb-4 sm:px-6 sm:pb-6');
content = content.replace('h-24 w-24 md:h-32 md:w-32', 'h-16 w-16 md:h-24 md:w-24');
content = content.replace('w-10 h-10 md:w-12 md:h-12', 'w-8 h-8 md:w-10 md:h-10');
content = content.replace('-mt-12 md:-mt-16', '-mt-8 md:-mt-12');
content = content.replace('text-2xl sm:text-3xl font-bold', 'text-xl sm:text-2xl font-bold');
content = content.replace('px-3 sm:px-4 py-1 sm:py-1.5', 'px-2 sm:px-3 py-0.5 sm:py-1 text-xs');
content = content.replace('w-6 h-6 sm:w-7 sm:h-7', 'w-5 h-5 sm:w-6 sm:h-6');
content = content.replace('p-6 border border-gray-100', 'p-4 sm:p-5 border border-gray-100');

// Grid actions
content = content.replace('grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4', 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4');
content = content.replace('p-4 hover:shadow-md transition-all duration-300 relative', 'p-3 hover:shadow-md transition-all duration-300 relative');
content = content.replace('w-12 h-12 rounded-xl', 'w-10 h-10 rounded-xl');
content = content.replace('h-6 w-6', 'h-5 w-5');
content = content.replace('font-semibold text-gray-800', 'text-xs sm:text-sm font-semibold text-gray-800');

// Stats Grid
content = content.replace('grid-cols-1 md lg gap-6 mb-8', 'grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6'); // It had `grid-cols-1 md lg gap-6` which means classes might have been cut in grep. Let's do a more robust replace for stats:
content = content.replace('grid-cols-1 md lg gap-6 mb-8', 'grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6');
content = content.replace('grid grid-cols-1 md lg:grid-cols-4 gap-6 mb-8', 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6');
content = content.replace(/gap-6 mb-8/g, 'gap-3 sm:gap-4 mb-6');

// Stat Cards
content = content.replace('text-2xl font-bold text-gray-900', 'text-lg sm:text-xl font-bold text-gray-900');
content = content.replace('w-6 h-6', 'w-5 h-5');
content = content.replace(/p-3 rounded-xl/g, 'p-2 rounded-xl');
content = content.replace('p-6 border', 'p-4 sm:p-5 border');

// Charts
content = content.replace('h-80', 'h-64 sm:h-80');
content = content.replace(/gap-8 mb-8/g, 'gap-4 sm:gap-6 mb-6');
content = content.replace(/p-6 bg-white/g, 'p-4 sm:p-5 bg-white');

fs.writeFileSync(file, content);
console.log('VendorDashboard made smaller');
