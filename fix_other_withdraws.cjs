const fs = require('fs');

function fixVendorWithdraw() {
  const file = 'src/pages/vendor/withdraw/WithdrawDashboard.tsx';
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Header
  content = content.replace('text-2xl font-bold', 'text-xl font-bold');
  content = content.replace('w-8 h-8 text-primary-main', 'w-6 h-6 text-primary-main');
  content = content.replace('mb-6', 'mb-4');
  
  // Container padding
  content = content.replace(/p-6/g, 'p-4 md:p-5');
  
  // Title / Balance
  content = content.replace('text-lg font-bold', 'text-base font-bold');
  content = content.replace('text-xl font-bold', 'text-lg font-bold');
  
  // Form spacing
  content = content.replace('space-y-6', 'space-y-4');
  
  // Inputs
  content = content.replace('pl-8 pr-4 py-3', 'pl-7 pr-3 py-2 text-sm');
  content = content.replace('text-lg', 'text-base');
  
  // Methods
  content = content.replace('w-6 h-6', 'w-5 h-5');
  content = content.replace('w-6 h-6', 'w-5 h-5');
  content = content.replace('p-3 border rounded-xl', 'p-2 border rounded-xl');
  
  content = content.replace('px-4 py-2 bg-white', 'px-3 py-1.5 sm:px-4 sm:py-2 bg-white text-sm');
  
  // Button
  content = content.replace('px-6 py-3', 'px-4 py-2.5 text-sm sm:text-base');
  content = content.replace('px-6 py-3', 'px-4 py-2.5 text-sm sm:text-base');

  fs.writeFileSync(file, content);
  console.log('Vendor WithdrawDashboard made smaller');
}

function fixResellerWithdraw() {
  const file = 'src/pages/reseller/withdraw/ResellerWithdraw.tsx';
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Similar fixes
  content = content.replace('py-8 px-4 sm:px-6 lg:px-8', 'py-4 px-4 sm:px-6 lg:px-8');
  content = content.replace('text-2xl font-bold', 'text-xl font-bold');
  content = content.replace('w-8 h-8 text-primary-main', 'w-6 h-6 text-primary-main');
  content = content.replace(/mb-8/g, 'mb-4 sm:mb-6');
  
  content = content.replace(/p-6/g, 'p-4 md:p-5');
  content = content.replace('text-lg font-bold', 'text-base font-bold');
  content = content.replace('text-xl font-bold', 'text-lg font-bold');
  
  content = content.replace('space-y-6', 'space-y-4');
  
  content = content.replace('pl-8 pr-4 py-3', 'pl-7 pr-3 py-2.5 text-sm');
  
  content = content.replace('w-6 h-6', 'w-5 h-5');
  content = content.replace('w-6 h-6', 'w-5 h-5');
  content = content.replace('p-3 border rounded-xl', 'p-2 border rounded-xl');
  
  content = content.replace('px-4 py-2', 'px-3 py-1.5 sm:px-4 sm:py-2 text-sm');
  
  content = content.replace('px-6 py-3', 'px-4 py-2.5 text-sm sm:text-base');

  fs.writeFileSync(file, content);
  console.log('Reseller Withdraw made smaller');
}

fixVendorWithdraw();
fixResellerWithdraw();
