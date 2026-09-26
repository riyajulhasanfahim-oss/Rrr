import { safeStorage } from "../utils/storage";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { rtdbSubscribe, rtdbSet } from '../lib/rtdb';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

import type { ResellerPriceSnapshot } from '../types/resellerProduct';

export interface CartItem {
  id: string;
  cartItemId?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  adminPrice?: number;
  vendorPrice?: number;
  resellerSellingPrice?: number;
  unitProfit?: number;
  resellerProfit?: number;
  priceSnapshot?: ResellerPriceSnapshot;
  referralId?: string;
  vendorId?: string;
  storeId?: string;
  category?: string;
  quantity: number;
  color?: string;
  size?: string;
  selectedColor?: string;
  selectedSize?: string;
  variantId?: string;
  variantSku?: string;
  sku?: string;
  stock?: number;
  weight?: number | string;
  specifications?: any;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      if (!user) {
        // Load from local storage if guest
        const saved = safeStorage.getItem('guestCart');
        if (saved) {
          try {
            setItems(JSON.parse(saved));
          } catch (e) {
            console.error(e);
          }
        } else {
          setItems([]);
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (userId) {
      // Sync from RTDB
      const unsubscribeSnap = rtdbSubscribe<any>(`carts/${userId}`, (data) => {
        if (data && data.items) {
          setItems(Array.isArray(data.items) ? data.items : Object.values(data.items));
        } else {
          setItems([]);
        }
      });
      return () => {
        if (unsubscribeSnap) unsubscribeSnap();
      };
    }
  }, [userId]);

  const saveCart = async (newItems: CartItem[]) => {
    if (userId) {
      try {
        const cleanedItems = newItems.map(item => {
          const cleaned = { ...item };
          Object.keys(cleaned).forEach(key => {
            if (cleaned[key as keyof CartItem] === undefined) {
              delete cleaned[key as keyof CartItem];
            }
          });
          return cleaned;
        });
        await rtdbSet(`carts/${userId}`, {
          userId,
          items: cleanedItems,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error('Error saving cart to RTDB', err);
      }
    } else {
      safeStorage.setItem('guestCart', JSON.stringify(newItems));
      setItems(newItems);
    }
  };

  const getItemKey = (item: { id: string; cartItemId?: string; variantId?: string; color?: string; size?: string; selectedColor?: string; selectedSize?: string }) => {
    if (item.cartItemId) return item.cartItemId;
    const col = item.selectedColor || item.color || '';
    const sz = item.selectedSize || item.size || '';
    const varId = item.variantId || '';
    if (!varId && !col && !sz) return item.id;
    return `${item.id}_${varId}_${col}_${sz}`;
  };

  const addToCart = (newItem: CartItem) => {
    setItems((prev) => {
      const targetKey = getItemKey(newItem);
      const existingIdx = prev.findIndex(i => getItemKey(i) === targetKey);
      let nextItems: CartItem[];
      if (existingIdx !== -1) {
        nextItems = prev.map((item, idx) => 
          idx === existingIdx ? { ...item, quantity: item.quantity + newItem.quantity } : item
        );
      } else {
        nextItems = [...prev, { ...newItem, cartItemId: targetKey }];
      }
      
      saveCart(nextItems);
      return nextItems;
    });
  };

  const removeFromCart = (idOrKey: string) => {
    setItems((prev) => {
      const nextItems = prev.filter(i => getItemKey(i) !== idOrKey && i.id !== idOrKey && i.cartItemId !== idOrKey);
      saveCart(nextItems);
      return nextItems;
    });
  };

  const updateQuantity = (idOrKey: string, quantity: number) => {
    setItems((prev) => {
      const nextItems = prev.map(i => {
        if (getItemKey(i) === idOrKey || i.id === idOrKey || i.cartItemId === idOrKey) {
          const newQty = Math.max(1, quantity);
          const hasResellerPrices = i.resellerSellingPrice !== undefined && i.vendorPrice !== undefined;
          const unitProfit = hasResellerPrices 
            ? Math.max(0, Number((i.resellerSellingPrice! - i.vendorPrice!).toFixed(2)))
            : i.unitProfit;
          const resellerProfit = hasResellerPrices 
            ? Math.max(0, Number(((i.resellerSellingPrice! - i.vendorPrice!) * newQty).toFixed(2)))
            : (i.resellerProfit !== undefined ? Math.max(0, Number((((i.resellerProfit / Math.max(1, i.quantity)) * newQty)).toFixed(2))) : undefined);

          const updatedSnapshot = i.priceSnapshot ? {
            ...i.priceSnapshot,
            quantity: newQty,
            unitProfit: unitProfit ?? i.priceSnapshot.unitProfit,
            resellerProfit: resellerProfit ?? i.priceSnapshot.resellerProfit,
          } : undefined;

          return { 
            ...i, 
            quantity: newQty,
            unitProfit,
            resellerProfit,
            priceSnapshot: updatedSnapshot
          };
        }
        return i;
      });
      saveCart(nextItems);
      return nextItems;
    });
  };

  const clearCart = () => {
    setItems([]);
    saveCart([]);
  };

  const { userData } = useAuth();
  const isReseller = userData?.role === 'Reseller';

  // Calculate dynamic prices
  const processedItems = items.map(item => ({
    ...item,
    price: item.price
  }));

  const cartTotal = processedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const itemCount = processedItems.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items: processedItems, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
