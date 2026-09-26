const fs = require('fs');
const file = 'src/pages/CartPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<p className="text-xs text-gray-500 mt-1">Vendor: RJ World Official</p>`;
const replacement = `<p className="text-xs text-gray-500 mt-1">Vendor: RJ World Official</p>
                            {(item.color || item.size) && (
                              <p className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                                {item.color && <span className="bg-gray-100 px-2 py-0.5 rounded">Color: {item.color}</span>}
                                {item.size && <span className="bg-gray-100 px-2 py-0.5 rounded">Size: {item.size}</span>}
                              </p>
                            )}`;
content = content.replace(target, replacement);

fs.writeFileSync(file, content);
