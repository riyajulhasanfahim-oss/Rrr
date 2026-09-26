import { safeStorage } from "../utils/storage";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface WishlistItem {
  id: string; // product id
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviews?: number;
  discount?: number;
  addedAt: number;
}

interface WishlistContextType {
  items: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  clearWishlist: () => void;
  itemCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      if (!user) {
        // Load from local storage if guest
        const saved = safeStorage.getItem('guestWishlist');
        if (saved) {
          try {
            setItems(JSON.parse(saved));
          } catch (e) {
            console.error(e);
          }
        } else {
          setItems([]);
        }
      } else {
         // Optionally merge local storage wishlist with server on login
         const saved = safeStorage.getItem('guestWishlist');
         if (saved) {
             try {
                 const localItems: WishlistItem[] = JSON.parse(saved);
                 if (localItems.length > 0) {
                     // We handle merge below after first fetch
                 }
             } catch (e) {
                 console.error(e);
             }
         }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (userId) {
      // Sync from firestore
      const wishlistRef = doc(db, 'wishlists', userId);
      const unsubscribeSnap = onSnapshot(wishlistRef, async (docSnap) => {
        if (docSnap.exists()) {
          const serverItems = docSnap.data().items || [];
          
          // Check if we need to merge guest wishlist
          const saved = safeStorage.getItem('guestWishlist');
          if (saved) {
              try {
                  const localItems: WishlistItem[] = JSON.parse(saved);
                  if (localItems.length > 0) {
                      const mergedItems = [...serverItems];
                      let changed = false;
                      for (const localItem of localItems) {
                          if (!mergedItems.some(i => i.id === localItem.id)) {
                              mergedItems.push(localItem);
                              changed = true;
                          }
                      }
                      if (changed) {
                          setItems(mergedItems);
                          await setDoc(doc(db, 'wishlists', userId), {
                              userId,
                              items: mergedItems,
                              updatedAt: Date.now()
                          });
                      } else {
                          setItems(serverItems);
                      }
                      safeStorage.removeItem('guestWishlist');
                  } else {
                      setItems(serverItems);
                  }
              } catch(e) {
                  setItems(serverItems);
              }
          } else {
             setItems(serverItems);
          }

        } else {
           // Handle guest to server sync if firestore has no wishlist
           const saved = safeStorage.getItem('guestWishlist');
           if (saved) {
                try {
                  const localItems: WishlistItem[] = JSON.parse(saved);
                  setItems(localItems);
                  if (localItems.length > 0) {
                      await setDoc(doc(db, 'wishlists', userId), {
                          userId,
                          items: localItems,
                          updatedAt: Date.now()
                      });
                  }
                  safeStorage.removeItem('guestWishlist');
                } catch (e) {
                    setItems([]);
                }
           } else {
               setItems([]);
           }
        }
      }, (err) => {
        console.warn('Wishlist onSnapshot notice:', err);
      });
      return () => unsubscribeSnap();
    }
  }, [userId]);

  const saveWishlist = async (newItems: WishlistItem[]) => {
    if (userId) {
      try {
        await setDoc(doc(db, 'wishlists', userId), {
          userId,
          items: newItems,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error('Error saving wishlist to Firestore', err);
      }
    } else {
      safeStorage.setItem('guestWishlist', JSON.stringify(newItems));
      setItems(newItems);
    }
  };

  const addToWishlist = (newItem: WishlistItem) => {
    setItems((prev) => {
      const existing = prev.find(i => i.id === newItem.id);
      if (existing) return prev; // Already in wishlist
      const nextItems = [...prev, { ...newItem, addedAt: Date.now() }];
      saveWishlist(nextItems);
      return nextItems;
    });
  };

  const removeFromWishlist = (id: string) => {
    setItems((prev) => {
      const nextItems = prev.filter(i => i.id !== id);
      saveWishlist(nextItems);
      return nextItems;
    });
  };

  const isInWishlist = (id: string) => {
    return items.some(i => i.id === id);
  };

  const clearWishlist = () => {
    setItems([]);
    saveWishlist([]);
  };

  const itemCount = items.length;

  return (
    <WishlistContext.Provider value={{
      items, addToWishlist, removeFromWishlist, isInWishlist, clearWishlist, itemCount
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
