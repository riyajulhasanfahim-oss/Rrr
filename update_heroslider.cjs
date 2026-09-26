const fs = require('fs');
const file = 'src/components/home/HeroSlider.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('h-[140px] sm:h-[220px]', 'h-[120px] sm:h-[200px]');
content = content.replace('h-12 w-12', 'h-8 w-8 sm:h-10 sm:w-10');
content = content.replace('h-6 w-6', 'h-4 w-4 sm:h-5 sm:w-5');

fs.writeFileSync(file, content);
console.log('HeroSlider made smaller');
