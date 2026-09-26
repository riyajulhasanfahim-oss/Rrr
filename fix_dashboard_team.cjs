const fs = require('fs');
const file = 'src/pages/reseller/ResellerDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `            <Link 
              to="/reseller/products"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-main hover transition-colors shadow-sm"
            >
              Browse Products
            </Link>`;

const replacement = `            <Link 
              to="/reseller/products"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-main hover:bg-sky-600 transition-colors shadow-sm"
            >
              Browse Products
            </Link>
            <Link 
              to="/reseller/leadership"
              className="inline-flex items-center px-4 py-2 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <Users className="w-4 h-4 mr-2" />
              Team
            </Link>`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log('ResellerDashboard updated');
