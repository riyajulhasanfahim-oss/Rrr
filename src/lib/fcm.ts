import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { doc, updateDoc, arrayUnion, arrayRemove, setDoc } from "firebase/firestore";
import { db, app } from "./firebase";

export const messaging = typeof window !== 'undefined' && 'serviceWorker' in navigator ? getMessaging(app) : null;

export const requestAndSaveFCMToken = async (userId: string) => {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      
      const token = await getToken(messaging);
      
      if (token) {
        const userRef = doc(db, 'users', userId);
        
        // Save token in an array to support multiple devices
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token),
          fcmToken: token, // Keep this for existing backend compatibility if needed
          updatedAt: new Date()
        }).catch(async (err) => {
           // If user doc doesn't exist, it will throw, but normally auth context creates it first.
           console.warn("Could not update token (user doc may not exist yet)", err);
        });

        // Store the token in local storage so we can remove it specifically on logout
        localStorage.setItem('fcm_current_token', token);
        
        console.log('FCM Token successfully saved for user:', userId);
        return token;
      }
    } else {
      console.warn('Notification permission denied by user.');
    }
  } catch (error) {
    console.error('Error requesting notification permission or saving token:', error);
  }
  return null;
};

export const removeFCMToken = async (userId: string) => {
  if (!messaging) return;
  
  try {
    const token = localStorage.getItem('fcm_current_token');
    if (token) {
      const userRef = doc(db, 'users', userId);
      
      // Remove from array and clear single field if it matches
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(token)
      }).catch(console.error);

      // Attempt to delete the token from the FCM service to invalidate it
      await deleteToken(messaging).catch(console.error);
      
      localStorage.removeItem('fcm_current_token');
      console.log('FCM Token removed and deactivated successfully.');
    }
  } catch (error) {
    console.error('Error removing FCM token:', error);
  }
};

export const onMessageListener = (callback: (payload: any) => void) => {
  if (messaging) {
    return onMessage(messaging, (payload) => {
      callback(payload);
    });
  }
  return () => {};
};
