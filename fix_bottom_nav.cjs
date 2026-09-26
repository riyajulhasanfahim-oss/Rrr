const fs = require('fs');
const file = 'src/components/layout/BottomNavigation.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove Team from navItems
content = content.replace(
  "  { label: 'Team', icon: TeamIcon, route: '/reseller/leadership' },\n", 
  ""
);

// 2. Adjust Heights
content = content.replace("h-[80px]", "h-[65px]");
content = content.replace("h-[76px]", "h-[60px]");

// 3. Adjust Icon sizes
content = content.replace("w-6 h-6", "w-[22px] h-[22px]"); // slightly smaller than 6 (24px) -> 22px

// 4. Adjust text
content = content.replace("text-[10px] font-semibold mt-1", "text-[9px] font-semibold mt-0.5");

// 5. Change badge position
content = content.replace("-top-1.5 -right-2", "-top-1 -right-1.5");

fs.writeFileSync(file, content);
console.log('BottomNavigation updated');
