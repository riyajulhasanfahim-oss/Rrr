const fs = require('fs');
const file = 'src/components/product/ProductInfo.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const adminPrice = product.price;",
  "const adminPrice = (product as any).resellerPrice || product.price;"
);

// Add Color and Size state
const importStatement = `import React, { useState, useEffect } from 'react';`;
const newImports = `import React, { useState, useEffect } from 'react';\nimport { Check } from 'lucide-react';`;
content = content.replace(importStatement, newImports);

const stateHooks = `  const [quantity, setQuantity] = useState(1);`;
const newHooks = `  const [quantity, setQuantity] = useState(1);\n  const [selectedColor, setSelectedColor] = useState<string>('');\n  const [selectedSize, setSelectedSize] = useState<string>('');\n\n  const colors = (product as any).colors || [];\n  const sizes = (product as any).sizes || [];\n\n  useEffect(() => {\n    if (colors.length > 0 && !selectedColor) setSelectedColor(colors[0]);\n    if (sizes.length > 0 && !selectedSize) setSelectedSize(sizes[0]);\n  }, [product, colors, sizes]);`;
content = content.replace(stateHooks, newHooks);

const shortDesc = `<p className="text-slate-600 text-base leading-relaxed hidden sm:block">
        {product.shortDescription}
      </p>
      <hr className="border-slate-100" />`;

const productOptionsUI = `<p className="text-slate-600 text-base leading-relaxed hidden sm:block">
        {product.shortDescription}
      </p>

      {/* Colors */}
      {colors && colors.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Color</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((color: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedColor(color)}
                className={\`px-4 py-2 rounded-xl border text-sm font-bold transition-all \${selectedColor === color ? 'border-primary-main bg-sky-50 text-primary-main' : 'border-slate-200 text-slate-600 hover:border-slate-300'}\`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sizes */}
      {sizes && sizes.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Size</h3>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedSize(size)}
                className={\`px-4 py-2 rounded-xl border text-sm font-bold transition-all \${selectedSize === size ? 'border-primary-main bg-sky-50 text-primary-main' : 'border-slate-200 text-slate-600 hover:border-slate-300'}\`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weight */}
      {(product as any).weight && (
        <div className="pt-2">
          <p className="text-sm font-bold text-slate-700">
            Weight: <span className="font-normal text-slate-600">{(product as any).weight}g</span>
          </p>
        </div>
      )}

      <hr className="border-slate-100" />`;

content = content.replace(shortDesc, productOptionsUI);

// Add to cart payload: include color and size
const handleAddToCartPayload = `      name: product.name,
      price: isReseller ? resellerSellingPrice : product.price,`;
const newHandleAddToCartPayload = `      name: product.name,
      price: isReseller ? resellerSellingPrice : product.price,
      color: selectedColor || undefined,
      size: selectedSize || undefined,`;
content = content.replace(handleAddToCartPayload, newHandleAddToCartPayload);

// Buy now payload
const buyNowPayload = `       quantity,
      price: isReseller ? resellerSellingPrice : product.price,`;
const newBuyNowPayload = `       quantity,
      price: isReseller ? resellerSellingPrice : product.price,
      color: selectedColor || undefined,
      size: selectedSize || undefined,`;
content = content.replace(buyNowPayload, newBuyNowPayload);

fs.writeFileSync(file, content);
