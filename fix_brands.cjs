const fs = require('fs');
const file = 'src/components/home/BrandList.tsx';
let content = fs.readFileSync(file, 'utf8');

const fallbackGen = `const getFallbackBrands = () => {
  const fallbackBrands = new Map();
  INITIAL_PRODUCTS.forEach(p => {
    if (p.vendor && !fallbackBrands.has(p.vendor.id)) {
      fallbackBrands.set(p.vendor.id, {
        id: p.vendor.id,
        shopName: p.vendor.name,
        logo: null
      });
    }
  });
  return Array.from(fallbackBrands.values());
};`;

content = content.replace('export default function BrandList() {', `${fallbackGen}\n\nexport default function BrandList() {`);

// Set default state to fallback
content = content.replace('const [brands, setBrands] = useState<any[]>([]);', 'const [brands, setBrands] = useState<any[]>(getFallbackBrands());');
content = content.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(false); // Removed loading spinner completely');

const loadingBlock = `  if (loading) return (
    <div className="py-8 border-b border-slate-100 flex justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-main"></div>
    </div>
  );`;

content = content.replace(loadingBlock, '');

// Prevent replacing the default ones with empty
const targetFetch = `setBrands(brandData);`;
const newFetch = `if (brandData.length > 0) {
            setBrands(brandData);
          }`;
content = content.replace(targetFetch, newFetch);

fs.writeFileSync(file, content);
console.log('BrandList updated');
