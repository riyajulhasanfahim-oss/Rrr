const fs = require('fs');
const file = 'src/pages/CheckoutPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<p className="text-xs text-gray-500">Qty: {item.quantity}</p>`;
const replacement = `<p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                          {(item.color || item.size) && (
                            <p className="text-xs text-gray-600 mt-0.5 flex gap-1">
                               {item.color && <span className="bg-gray-100 px-1 rounded">{item.color}</span>}
                               {item.size && <span className="bg-gray-100 px-1 rounded">{item.size}</span>}
                            </p>
                          )}`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
