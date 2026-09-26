import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function handleVendorAccess(userId?: string) {
  try {
    const configRef = doc(db, 'settings', 'appConfig');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const data = configSnap.data();
      
      if (!data.vendorEnabled) {
        return {
          type: "redirect",
          url: `https://wa.me/${data.whatsappNumber || ''}?text=${encodeURIComponent("আমি আমার প্রোডাক্ট বিক্রি করতে চাই")}`
        };
      }
    }
  } catch (error) {
    console.error("Error checking vendor access:", error);
  }

  return {
    type: "allow",
    route: "/become-vendor"
  };
}
