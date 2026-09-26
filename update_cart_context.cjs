const fs = require('fs');
const file = 'src/contexts/CartContext.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "  quantity: number;\n}",
  "  quantity: number;\n  color?: string;\n  size?: string;\n}"
);

fs.writeFileSync(file, content);
