const fs = require('fs');
const file = 'src/pages/reseller/ResellerDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'className="mt-4 sm flex gap-3"',
  'className="mt-4 flex flex-wrap gap-2 sm:gap-3"'
);

fs.writeFileSync(file, content);
console.log('flex-wrap added');
