# RJ World BD — Android Automated SMS Reader & Payment Verification Service

Native Android background service and verification companion for **RJ World BD Multi-Role Platform**.

---

## 🚀 Key Features

1. **Automatic MFS Payment Detection**
   - Strictly listens for incoming SMS from verified Bangladeshi Mobile Financial Service (MFS) shortcodes:
     - **bKash** (`16247`, `bKash`)
     - **Nagad** (`16167`, `Nagad`)
     - **Rocket (DBBL)** (`16216`, `Rocket`, `DBBL`)
     - **Upay (UCB)** (`16268`, `upay`, `UCB`)
   - Rejects personal, promotional, OTP, or non-payment SMS immediately without processing.

2. **Security & Privacy First**
   - **Zero Raw SMS Storage**: Raw SMS message bodies are strictly parsed in memory and **never** stored in SQLite/Room or uploaded to Firebase.
   - Only sanitized payment metadata is extracted:
     - `paymentMethod` (bkash, nagad, rocket, upay)
     - `transactionId` (alphanumeric TrxID/TxnID)
     - `amount` (numeric received amount in BDT)
     - `senderNumber` (sender mobile/account)
     - `timestamp` (detection time)

3. **Persistent Foreground Service & Status Bar Notification**
   - Runs as an active Foreground Service (`SmsReaderForegroundService`) with ongoing, non-dismissible notification:
     - **Title**: `RJ World BD Payment Service`
     - **Body**: `Pending: X | Synced: X`
   - If permissions are missing or service is deactivated, notifies the administrator with an explicit inactive alert.
   - Automatically restarts on device reboot (`BootReceiver` on `BOOT_COMPLETED`).

4. **Duplicate Transaction Prevention**
   - Enforces unique Transaction ID checks across the local Room database before queuing.
   - Prevents duplicate order confirmations, double credits, and fraudulent repeat submissions.

5. **Offline-to-Online Resilience**
   - If the Android device loses cellular or Wi-Fi connectivity, extracted transactions are safely buffered in local Room SQLite storage (`PaymentVerificationEntity`).
   - `NetworkChangeReceiver` and WorkManager (`PaymentSyncWorker`) automatically trigger when internet connectivity is restored to batch upload pending payments to Firebase Firestore.

6. **Automatic Verification Engine**
   - Matches incoming transactions against Firestore in real-time:
     - **Customer Orders**: Matches TrxID + Payment Method + Order Total / Shipping Charge. Automatically transitions status from `Pending` to `Confirmed` and paymentStatus to `Paid`.
     - **Vendor Applications**: Matches TrxID + Registration Fee. Activates vendor and updates role to `Vendor`.
     - **Reseller Applications**: Matches TrxID + Registration Fee. Approves application and updates role to `Reseller`.

---

## 🛠️ Project Structure

```
android-sms-reader/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/rjworldbd/smsreader/
│   │   │   ├── RjWorldBdApplication.kt
│   │   │   ├── data/
│   │   │   │   ├── model/PaymentVerificationEntity.kt
│   │   │   │   └── local/
│   │   │   │       ├── PaymentDao.kt
│   │   │   │       └── PaymentDatabase.kt
│   │   │   ├── parser/PaymentSmsParser.kt
│   │   │   ├── receiver/
│   │   │   │   ├── SmsReceiver.kt
│   │   │   │   ├── BootReceiver.kt
│   │   │   │   └── NetworkChangeReceiver.kt
│   │   │   ├── service/SmsReaderForegroundService.kt
│   │   │   ├── sync/PaymentSyncWorker.kt
│   │   │   └── ui/MainActivity.kt
│   │   └── res/
│   │       ├── layout/activity_main.xml
│   │       ├── values/
│   │       │   ├── colors.xml
│   │       │   ├── strings.xml
│   │       │   └── styles.xml
│   │       └── mipmap-*/ic_launcher*.png
│   └── build.gradle
├── gradle/wrapper/gradle-wrapper.properties
├── build.gradle
├── settings.gradle
└── gradle.properties
```

---

## 📱 Build & Run Instructions

### In Android Studio
1. Open Android Studio and select **Open**, then browse to the `android-sms-reader` directory.
2. Allow Gradle to sync dependencies.
3. Place your production `google-services.json` inside `android-sms-reader/app/` if integrating directly with your Firebase project credentials.
4. Run on a physical Android test device (or emulator with SMS simulation capability).

### Permissions Required
On first launch, grant the required runtime permissions:
- **SMS Receive & Read** (`android.permission.RECEIVE_SMS`, `android.permission.READ_SMS`)
- **Notifications** (`android.permission.POST_NOTIFICATIONS` on Android 13+)
