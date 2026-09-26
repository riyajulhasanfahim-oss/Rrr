const fs = require('fs');
const file = 'src/pages/reseller/ResellerDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Top section spacing
content = content.replace('py-8 px-4 sm:px-6 lg:px-8 max-w-7xl', 'py-4 px-2 sm:px-4 lg:px-8 max-w-7xl');
content = content.replace('mb-8 flex flex-col', 'mb-4 flex flex-col');
content = content.replace('text-2xl font-bold', 'text-lg sm:text-xl font-bold');

// Buttons
content = content.replace(/px-4 py-2/g, 'px-3 py-1.5');

// Stats Grid layout
content = content.replace(
  'className="grid grid-cols-1 gap-5 sm:px-6 lg:px-8 mb-8"', 
  'className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6"'
);

// Stat card styling
content = content.replace('pt-5 px-4 pb-6', 'pt-4 px-3 pb-4');
content = content.replace('absolute bg-primary-main/10 rounded-xl p-3', 'absolute bg-primary-main/10 rounded-xl p-2');
content = content.replace('h-6 w-6 text-primary-main', 'h-4 w-4 sm:h-5 sm:w-5 text-primary-main');
content = content.replace('ml-16', 'ml-10 sm:ml-12');
content = content.replace('ml-16', 'ml-10 sm:ml-12'); // for the <dd>
content = content.replace('text-2xl font-semibold', 'text-lg sm:text-xl font-semibold');

// Charts
content = content.replace('mb-8', 'mb-5');
content = content.replace('mb-8', 'mb-5');
content = content.replace('p-6', 'p-4 sm:p-5');
content = content.replace('h-72', 'h-48 sm:h-64');

// Quick Actions
content = content.replace('grid-cols-2 sm gap-4 mb-8', 'grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-4 mb-6');
content = content.replace('p-6 bg-white', 'p-3 sm:p-4 bg-white');
content = content.replace('w-12 h-12 rounded-full', 'w-10 h-10 rounded-full');
content = content.replace('h-6 w-6 text-gray-600', 'h-4 w-4 sm:h-5 sm:w-5 text-gray-600');
content = content.replace('text-sm font-medium', 'text-xs sm:text-sm font-medium');

// Table
content = content.replace('px-6 py-4', 'px-3 py-3 sm:px-4 sm:py-4');
content = content.replace('px-6 py-3', 'px-3 py-2 sm:px-4 sm:py-3');

fs.writeFileSync(file, content);
console.log('ResellerDashboard made smaller');
