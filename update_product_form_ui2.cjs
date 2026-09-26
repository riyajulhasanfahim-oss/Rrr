const fs = require('fs');
const file = 'src/pages/vendor/products/ProductForm.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchTagsBlock = `                <div>
                  <label className="block text-sm font-medium text-gray-700  mb-1">Tags</label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="Comma separated"
                    className="w-full px-4 py-2 bg-white  border border-gray-300  rounded-lg focus focus outline-none text-gray-900 "
                  />
                </div>`;

const newFieldsBlock = `                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="Comma separated"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color Options</label>
                  <input
                    type="text"
                    name="colors"
                    value={formData.colors}
                    onChange={handleChange}
                    placeholder="Red, Blue, Green (comma separated)"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size Options</label>
                  <input
                    type="text"
                    name="sizes"
                    value={formData.sizes}
                    onChange={handleChange}
                    placeholder="S, M, L, XL (comma separated)"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (Gram)</label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    placeholder="e.g. 500"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus outline-none text-gray-900"
                  />
                </div>`;

content = content.replace(searchTagsBlock, newFieldsBlock);

fs.writeFileSync(file, content);
