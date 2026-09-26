const fs = require('fs');
const file = 'src/pages/vendor/products/ProductForm.tsx';
let content = fs.readFileSync(file, 'utf8');

const calculatedResellerText = `{formData.price && (
                    <p className="mt-1 text-xs text-green-600 font-medium">
                      Reseller Price (calculated): ৳{(parseFloat(formData.price) * 0.8).toFixed(2)}
                    </p>
                  )}`;

// Remove the calculated reseller price text
content = content.replace(calculatedResellerText, "");

const insertAfterSalePrice = `                <div>
                  <label className="block text-sm font-medium text-gray-700  mb-1">Reseller Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      name="resellerPrice"
                      value={formData.resellerPrice}
                      onChange={handleChange}
                      className="w-full pl-8 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                    />
                  </div>
                </div>`;

const searchSalePriceBlock = `                <div>
                  <label className="block text-sm font-medium text-gray-700  mb-1">Sale Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      name="salePrice"
                      value={formData.salePrice}
                      onChange={handleChange}
                      className="w-full pl-8 pr-4 py-2 bg-white  border border-gray-300  rounded-lg focus focus outline-none text-gray-900 "
                    />
                  </div>
                </div>`;

// Insert Reseller Price
content = content.replace(searchSalePriceBlock, searchSalePriceBlock + '\n' + insertAfterSalePrice);

const productOptionsBlock = `
            {/* Product Options & Metadata */}
            <div className="bg-slate-50  rounded-2xl p-6 border border-slate-200 ">
              <h2 className="text-lg font-bold text-gray-900  mb-4">Product Options</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700  mb-1">Colors (comma separated)</label>
                  <input
                    type="text"
                    name="colors"
                    value={formData.colors}
                    onChange={handleChange}
                    placeholder="Red, Blue, Green"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700  mb-1">Sizes (comma separated)</label>
                  <input
                    type="text"
                    name="sizes"
                    value={formData.sizes}
                    onChange={handleChange}
                    placeholder="S, M, L, XL"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700  mb-1">Weight (Gram)</label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    placeholder="e.g. 500"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700  mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="electronics, gadgets, new"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                  />
                </div>
              </div>
            </div>
`;

// Insert the new block and replace the old Tags input
const searchTagsBlock = `                <div>
                  <label className="block text-sm font-medium text-gray-700  mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white  border border-gray-300  rounded-lg focus focus outline-none text-gray-900 "
                    placeholder="electronics, gadgets, new"
                  />
                </div>`;

content = content.replace(searchTagsBlock, productOptionsBlock);

fs.writeFileSync(file, content);
