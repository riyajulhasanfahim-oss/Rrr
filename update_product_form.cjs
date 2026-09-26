const fs = require('fs');
const file = 'src/pages/vendor/products/ProductForm.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add to initial state
content = content.replace(
  "tags: '',",
  "tags: '',\n    resellerPrice: '',\n    weight: '',\n    colors: '',\n    sizes: '',"
);

// 2. Add to useEffect populate
content = content.replace(
  "tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''),",
  "tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''),\n              resellerPrice: data.resellerPrice?.toString() || '',\n              weight: data.weight || '',\n              colors: Array.isArray(data.colors) ? data.colors.join(', ') : (data.colors || ''),\n              sizes: Array.isArray(data.sizes) ? data.sizes.join(', ') : (data.sizes || ''),"
);

// 3. Add to productData object
content = content.replace(
  "tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),",
  "tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),\n        resellerPrice: formData.resellerPrice ? parseFloat(formData.resellerPrice) : null,\n        weight: formData.weight,\n        colors: formData.colors.split(',').map(c => c.trim()).filter(Boolean),\n        sizes: formData.sizes.split(',').map(s => s.trim()).filter(Boolean),"
);

fs.writeFileSync(file, content);
