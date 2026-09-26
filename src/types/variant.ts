export interface ProductColor {
  id: string;
  name: string;
  image?: string;
}

export interface ProductSize {
  id: string;
  name: string;
}

export interface ProductVariant {
  id: string;
  colorId?: string;
  colorName?: string;
  sizeId?: string;
  sizeName?: string;
  title: string;
  price: number;
  salePrice?: number | null;
  stock: number;
  sku: string;
  image?: string;
}
