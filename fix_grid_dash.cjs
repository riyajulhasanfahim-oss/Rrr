const fs = require('fs');
const file = 'src/pages/vendor/VendorDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('grid-cols-1 lg gap-4 sm:gap-6 mb-6', 'grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6');
content = content.replace('grid-cols-1 md gap-8', 'grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6');

fs.writeFileSync(file, content);
console.log('Grid fixed');
