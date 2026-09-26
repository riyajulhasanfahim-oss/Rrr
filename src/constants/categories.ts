export interface MainCategory {
  id: string;
  name: string;
  path: string;
  imageUrl: string;
  order: number;
  iconName?: string;
  color?: string;
}

export const MAIN_CATEGORIES: MainCategory[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    path: 'electronics',
    imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=300&h=300',
    order: 1,
    iconName: 'Monitor',
    color: 'bg-sky-100 text-sky-600'
  },
  {
    id: 'fashion',
    name: 'Fashion',
    path: 'fashion',
    imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=300&h=300',
    order: 2,
    iconName: 'ShoppingBag',
    color: 'bg-pink-100 text-pink-600'
  },
  {
    id: 'beauty-personal-care',
    name: 'Beauty & Personal Care',
    path: 'beauty-personal-care',
    imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=300&h=300',
    order: 3,
    iconName: 'Sparkles',
    color: 'bg-rose-100 text-rose-600'
  },
  {
    id: 'home-living',
    name: 'Home & Living',
    path: 'home-living',
    imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=300&h=300',
    order: 4,
    iconName: 'Home',
    color: 'bg-orange-100 text-orange-600'
  },
  {
    id: 'grocery-food',
    name: 'Grocery & Food',
    path: 'grocery-food',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300&h=300',
    order: 5,
    iconName: 'ShoppingCart',
    color: 'bg-green-100 text-green-600'
  },
  {
    id: 'health-wellness',
    name: 'Health & Wellness',
    path: 'health-wellness',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=300&h=300',
    order: 6,
    iconName: 'Heart',
    color: 'bg-emerald-100 text-emerald-600'
  },
  {
    id: 'baby-kids',
    name: 'Baby & Kids',
    path: 'baby-kids',
    imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&q=80&w=300&h=300',
    order: 7,
    iconName: 'Baby',
    color: 'bg-teal-100 text-teal-600'
  },
  {
    id: 'sports-outdoor',
    name: 'Sports & Outdoor',
    path: 'sports-outdoor',
    imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=300&h=300',
    order: 8,
    iconName: 'Dumbbell',
    color: 'bg-red-100 text-red-600'
  },
  {
    id: 'automotive-motorbike',
    name: 'Automotive & Motorbike',
    path: 'automotive-motorbike',
    imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&q=80&w=300&h=300',
    order: 9,
    iconName: 'Car',
    color: 'bg-slate-100 text-slate-700'
  },
  {
    id: 'books-stationery',
    name: 'Books & Stationery',
    path: 'books-stationery',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=300&h=300',
    order: 10,
    iconName: 'BookOpen',
    color: 'bg-amber-100 text-amber-600'
  },
  {
    id: 'computer-gaming',
    name: 'Computer & Gaming',
    path: 'computer-gaming',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=300&h=300',
    order: 11,
    iconName: 'Gamepad2',
    color: 'bg-indigo-100 text-indigo-600'
  },
  {
    id: 'jewelry-accessories',
    name: 'Jewelry & Accessories',
    path: 'jewelry-accessories',
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=300&h=300',
    order: 12,
    iconName: 'Gem',
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    id: 'agriculture-gardening',
    name: 'Agriculture & Gardening',
    path: 'agriculture-gardening',
    imageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&q=80&w=300&h=300',
    order: 13,
    iconName: 'Flower2',
    color: 'bg-lime-100 text-lime-600'
  },
  {
    id: 'pet-supplies',
    name: 'Pet Supplies',
    path: 'pet-supplies',
    imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=300&h=300',
    order: 14,
    iconName: 'PawPrint',
    color: 'bg-cyan-100 text-cyan-600'
  },
  {
    id: 'others',
    name: 'Others',
    path: 'others',
    imageUrl: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&q=80&w=300&h=300',
    order: 15,
    iconName: 'MoreHorizontal',
    color: 'bg-neutral-100 text-neutral-600'
  }
];

export const MAIN_CATEGORY_NAMES = MAIN_CATEGORIES.map(c => c.name);

export function isCategoryMatching(
  productCategory: string | undefined | null,
  targetSlugOrName: string | undefined | null
): boolean {
  if (!targetSlugOrName || targetSlugOrName.toLowerCase() === 'all') return true;
  if (!productCategory) return false;

  const clean = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

  const normTarget = clean(decodeURIComponent(targetSlugOrName));
  const normProd = clean(productCategory);

  if (normProd === normTarget) return true;

  // Find canonical category for target
  const targetCanonical = MAIN_CATEGORIES.find(c => 
    clean(c.name) === normTarget || 
    clean(c.path) === normTarget || 
    clean(c.id) === normTarget
  );

  if (targetCanonical) {
    if (
      clean(targetCanonical.name) === normProd || 
      clean(targetCanonical.path) === normProd || 
      clean(targetCanonical.id) === normProd
    ) {
      return true;
    }
  }

  // Find canonical category for product category
  const prodCanonical = MAIN_CATEGORIES.find(c =>
    clean(c.name) === normProd ||
    clean(c.path) === normProd ||
    clean(c.id) === normProd
  );

  if (prodCanonical) {
    if (
      clean(prodCanonical.name) === normTarget || 
      clean(prodCanonical.path) === normTarget || 
      clean(prodCanonical.id) === normTarget
    ) {
      return true;
    }
  }

  return normProd.includes(normTarget) || normTarget.includes(normProd);
}
