import React from 'react';
import { useShopDomain } from './ShopDomainWrapper';
import Home from '../pages/Home';
import VendorStore from '../pages/VendorStore';

export default function RootRoute() {
  const { vendorId, isShopDomain } = useShopDomain();
  
  if (isShopDomain && vendorId) {
    return <VendorStore propVendorId={vendorId} />;
  }
  
  return <Home />;
}
