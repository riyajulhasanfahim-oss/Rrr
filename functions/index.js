// ================= CLOUD FUNCTION (BACKEND) =================
// এই অংশ Firebase Functions এ deploy করতে হবে

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.onOrderComplete = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change) => {
    const after = change.after.data();

    if (after.status !== "completed") return;

    const amount = after.amount;
    let currentUser = after.userId;

    // 7 LEVEL MLM
    const levels = [0.10, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01];

    for (let i = 0; i < 7; i++) {
      const userDoc = await admin.firestore().collection("users").doc(currentUser).get();
      if (!userDoc.exists) break;

      const ref = userDoc.data().referredBy;
      if (!ref) break;

      const commission = amount * levels[i];

      await admin.firestore().collection("users").doc(ref).update({
        balance: admin.firestore.FieldValue.increment(commission),
        totalEarnings: admin.firestore.FieldValue.increment(commission)
      });

      currentUser = ref;
    }
  });

// ==== PUSH NOTIFICATION & IMGBB PROXY ====

// Sends push notification using Firebase Admin SDK
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated and is an admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Only authenticated users can send notifications.');
  }
  
  // Note: In a real app, verify that context.auth.uid is an admin.
  // We'll trust the call for this prototype, but you should add admin claims check.

  const { title, body, imageUrl, targetTokens, dataPayload } = data;

  if (!title || !body || !targetTokens || !Array.isArray(targetTokens)) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields or targetTokens is not an array.');
  }

  if (targetTokens.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0, message: "No tokens to send to." };
  }

  const message = {
    notification: {
      title,
      body,
      ...(imageUrl && { imageUrl }) // Firebase supports imageUrl in notification payload for Android/iOS
    },
    data: dataPayload || {},
    tokens: targetTokens, // Multicast message
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      success: true,
      sentCount: response.successCount,
      failedCount: response.failureCount,
      responses: response.responses
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send push notification.');
  }
});

