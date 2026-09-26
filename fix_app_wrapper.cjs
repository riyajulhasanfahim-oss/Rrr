const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `</Routes>\n          </ShopDomainWrapper>\n        <BottomNavigation />\n      </Router>`,
  `</Routes>\n        <BottomNavigation />\n          </ShopDomainWrapper>\n      </Router>`
);

fs.writeFileSync(file, content);
