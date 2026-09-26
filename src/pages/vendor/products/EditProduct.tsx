import React from 'react';
import { useParams } from 'react-router-dom';
import ProductForm from './ProductForm';

export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  
  if (!id) return null;
  
  return <ProductForm productId={id} />;
}
