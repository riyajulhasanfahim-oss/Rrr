const fs = require('fs');
const file = 'src/components/home/Categories.tsx';
let content = fs.readFileSync(file, 'utf8');

const defaultCategories = `const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Electronics', imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200&h=200&fit=crop', path: 'electronics' },
  { id: 'cat-2', name: 'Fashion', imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&h=200&fit=crop', path: 'fashion' },
  { id: 'cat-3', name: 'Home & Living', imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=200&h=200&fit=crop', path: 'home-and-living' },
  { id: 'cat-4', name: 'Beauty', imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&h=200&fit=crop', path: 'beauty' },
  { id: 'cat-5', name: 'Sports', imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&h=200&fit=crop', path: 'sports' },
];`;

content = content.replace('export default function Categories() {', `${defaultCategories}\n\nexport default function Categories() {`);

// Replace loading state and empty state
content = content.replace('const [categories, setCategories] = useState<any[]>([]);', 'const [categories, setCategories] = useState<any[]>(DEFAULT_CATEGORIES);');
content = content.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(false); // Removed loading spinner completely');

const loadingBlock = `  if (loading) {
    return (
      <section className="relative pt-3 sm:pt-4 pb-2 bg-gradient-to-br from-slate-50 via-white to-sky-50/30 border-b border-slate-100 overflow-hidden min-h-[120px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-primary-main"></div>
      </section>
    );
  }`;

content = content.replace(loadingBlock, '');

// Prevent replacing the default ones with empty
const targetFetch = `setCategories(catsData);`;
const newFetch = `if (catsData.length > 0) {
            setCategories(catsData);
          }`;
content = content.replace(targetFetch, newFetch);

fs.writeFileSync(file, content);
console.log('Categories updated');
