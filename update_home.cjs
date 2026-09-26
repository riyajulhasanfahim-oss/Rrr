const fs = require('fs');
const file = 'src/pages/Home.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('pb-24', 'pb-20');

fs.writeFileSync(file, content);
console.log('Home made smaller');
