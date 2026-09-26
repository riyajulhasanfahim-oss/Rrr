package com.rjworldbd.smsreader.sync;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import com.rjworldbd.smsreader.data.PaymentDbHelper;
import com.rjworldbd.smsreader.data.PaymentDbHelper.PendingPaymentRecord;
import com.rjworldbd.smsreader.service.SmsReaderForegroundService;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SyncManager {

    private static final String TAG = "RJ_SMS_SYNC";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final int MAX_DIAGNOSTIC_LOGS = 50;

    // Synchronized diagnostic memory log buffer for UI inspection
    private static final List<String> DIAGNOSTIC_LOGS = new ArrayList<>();
    private static SyncLogListener logListener = null;

    public interface SyncLogListener {
        void onLogUpdated(String fullLogText);
    }

    public static synchronized void setLogListener(SyncLogListener listener) {
        logListener = listener;
        if (listener != null) {
            listener.onLogUpdated(getDiagnosticLogsText());
        }
    }

    public static synchronized void addDiagnosticLog(String message) {
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
        String entry = "[" + timestamp + "] " + message;
        Log.i(TAG, entry);
        DIAGNOSTIC_LOGS.add(entry);
        if (DIAGNOSTIC_LOGS.size() > MAX_DIAGNOSTIC_LOGS) {
            DIAGNOSTIC_LOGS.remove(0);
        }
        if (logListener != null) {
            final String text = getDiagnosticLogsText();
            logListener.onLogUpdated(text);
        }
    }

    public static synchronized String getDiagnosticLogsText() {
        if (DIAGNOSTIC_LOGS.isEmpty()) {
            return "No sync logs yet. Ready.";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = DIAGNOSTIC_LOGS.size() - 1; i >= 0; i--) {
            sb.append(DIAGNOSTIC_LOGS.get(i)).append("\n");
        }
        return sb.toString();
    }

    private static final String FIREBASE_RTDB_BASE_URL = "https://rjworldbdcom-default-rtdb.firebaseio.com/payments";

    /**
     * Retrieves the ordered list of sync candidate endpoints.
     * The production Cloud Run URL and the custom production domain are tried first.
     */
    public static List<String> getCandidateEndpoints(Context context) {
        List<String> list = new ArrayList<>();
        
        // 1. Live Google Cloud Run backend for RJ World BD (Direct HTTPS)
        list.add("https://ais-dev-6fbr6wfsfb733bpemqpi5w-645913857598.asia-southeast1.run.app/api/payment/sms-sync");
        list.add("https://ais-pre-6fbr6wfsfb733bpemqpi5w-645913857598.asia-southeast1.run.app/api/payment/sms-sync");
        
        // 2. Custom production domain HTTPS endpoints
        list.add("https://rjworldbd.com/api/payment/sms-sync");
        list.add("https://www.rjworldbd.com/api/payment/sms-sync");

        // 3. Optional user-configured server URL from SharedPreferences
        if (context != null) {
            try {
                SharedPreferences prefs = context.getSharedPreferences("rj_sms_prefs", Context.MODE_PRIVATE);
                String customUrl = prefs.getString("custom_server_url", null);
                if (customUrl != null && !customUrl.trim().isEmpty()) {
                    String clean = customUrl.trim();
                    if (!clean.endsWith("/api/payment/sms-sync")) {
                        if (clean.endsWith("/")) {
                            clean = clean + "api/payment/sms-sync";
                        } else {
                            clean = clean + "/api/payment/sms-sync";
                        }
                    }
                    if (!list.contains(clean)) {
                        list.add(0, clean); // Custom prioritized if explicitly set
                    }
                }
            } catch (Exception ignored) {}
        }

        return list;
    }

    /**
     * Triggers synchronization of all pending SMS payment records in background thread.
     * Step 1: Uploads pending records to backend and Firebase RTDB (marked as 'uploaded', status remains 'pending').
     * Step 2: Checks if pending records were verified on the website (if verified, transitions status to 'verified', Synced becomes 1).
     */
    public static void triggerSync(final Context context) {
        if (context == null) return;
        final Context appContext = context.getApplicationContext();
        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    PaymentDbHelper db = PaymentDbHelper.getInstance(appContext);
                    List<PendingPaymentRecord> uploadList = db.getPendingUploadPayments();

                    addDiagnosticLog("SYNC CHECK: Found " + uploadList.size() + " un-uploaded payment(s)");

                    int uploadedCount = 0;
                    List<String> endpoints = getCandidateEndpoints(appContext);

                    for (PendingPaymentRecord item : uploadList) {
                        addDiagnosticLog("Uploading TrxID: " + item.transactionId + " (" + item.paymentMethod + " Tk " + item.receivedAmount + ")");
                        boolean uploaded = uploadPaymentToBackendAndRtdb(item, endpoints, appContext);
                        if (uploaded) {
                            db.markUploaded(item.transactionId);
                            uploadedCount++;
                            addDiagnosticLog("SUCCESS: TrxID " + item.transactionId + " available for verification (Pending: " + db.getPendingCount() + ", Synced: " + db.getSyncedCount() + ")");
                        } else {
                            addDiagnosticLog("RETRY: TrxID " + item.transactionId + " could not connect to backend/RTDB yet");
                        }
                    }

                    // Step 2: Check if any pending payments have been verified on the website
                    List<PendingPaymentRecord> pendingVerificationList = db.getPendingVerificationPayments();
                    int newlyVerifiedCount = 0;
                    for (PendingPaymentRecord item : pendingVerificationList) {
                        boolean isVerified = checkPaymentVerifiedOnWebsite(item.transactionId);
                        if (isVerified) {
                            db.markVerified(item.transactionId);
                            newlyVerifiedCount++;
                            addDiagnosticLog("WEBSITE VERIFIED! TrxID " + item.transactionId + " now SYNCED! (Pending: " + db.getPendingCount() + ", Synced: " + db.getSyncedCount() + ")");
                        }
                    }

                    int finalPending = db.getPendingCount();
                    int finalSynced = db.getSyncedCount();
                    if (uploadedCount > 0 || newlyVerifiedCount > 0) {
                        addDiagnosticLog("STATUS: Pending: " + finalPending + " | Synced: " + finalSynced);
                    }
                    SmsReaderForegroundService.updateCounts(appContext, finalPending, finalSynced);

                } catch (Exception e) {
                    addDiagnosticLog("CRITICAL SYNC ERROR: " + e.getMessage());
                }
            }
        });
    }

    /**
     * Immediately uploads a newly detected parsed payment to Firebase RTDB and backend with zero delay.
     */
    public static void syncPaymentImmediately(final Context context, final PaymentSmsParser.ParsedPayment payment) {
        if (context == null || payment == null) return;
        final Context appContext = context.getApplicationContext();
        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    PaymentDbHelper db = PaymentDbHelper.getInstance(appContext);
                    PendingPaymentRecord record = new PendingPaymentRecord(
                            "PAY-" + Long.toString(System.currentTimeMillis(), 36).toUpperCase(),
                            "INV-" + (System.currentTimeMillis() % 1000000),
                            "android_sms_detected",
                            "customer",
                            payment.paymentMethod,
                            payment.amount,
                            payment.transactionId,
                            "pending",
                            payment.senderNumber,
                            payment.amount,
                            payment.timestamp,
                            "pending_sync"
                    );
                    List<String> endpoints = getCandidateEndpoints(appContext);
                    boolean uploaded = uploadPaymentToBackendAndRtdb(record, endpoints, appContext);
                    if (uploaded) {
                        db.markUploaded(payment.transactionId);
                        int finalPending = db.getPendingCount();
                        int finalSynced = db.getSyncedCount();
                        SmsReaderForegroundService.updateCounts(appContext, finalPending, finalSynced);
                    }
                } catch (Exception e) {
                    addDiagnosticLog("Immediate upload error: " + e.getMessage());
                }
            }
        });
    }

    /**
     * Uploads pending payment record to Firebase RTDB and candidate server endpoints.
     * Keeps verificationStatus as 'pending' so website can verify it.
     */
    private static boolean uploadPaymentToBackendAndRtdb(PendingPaymentRecord record, List<String> endpoints, Context context) {
        boolean rtdbSuccess = uploadToFirebaseRtdb(record, context);
        boolean serverSuccess = uploadPaymentToServer(record, endpoints);
        return rtdbSuccess || serverSuccess;
    }

    /**
     * Formats amount cleanly (e.g., 10.0 -> 10, 10.5 -> 10.5).
     */
    private static String formatAmount(double amount) {
        if (amount == (long) amount) {
            return String.valueOf((long) amount);
        }
        return String.valueOf(amount);
    }

    /**
     * Attempts upload via native Firebase SDK if available, or direct Firebase RTDB REST API.
     * Logs exact diagnostic information formatted per security requirements.
     */
    private static boolean uploadToFirebaseRtdb(PendingPaymentRecord record, Context context) {
        String cleanTrx = record.transactionId != null ? record.transactionId.trim().toUpperCase() : "";
        String cleanAmount = formatAmount(record.receivedAmount);
        String targetPath = "payments";

        // 1. Try Native Firebase Realtime Database Android SDK first
        boolean sdkSuccess = uploadViaFirebaseSdk(record, context, cleanTrx, cleanAmount, targetPath);
        if (sdkSuccess) {
            addDiagnosticLog("Firebase sync success\nTransaction ID: " + cleanTrx + "\nAmount: " + cleanAmount + "\nPath: " + targetPath);
            return true;
        }

        // 2. Direct HTTP REST API to Firebase RTDB endpoint
        HttpURLConnection conn = null;
        try {
            String rtdbUrl = FIREBASE_RTDB_BASE_URL + ".json";
            URL url = new URL(rtdbUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setDoOutput(true);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            String rtdbPayload = "{" +
                    "\"transactionId\":\"" + escapeJson(cleanTrx) + "\"," +
                    "\"paymentMethod\":\"" + escapeJson(record.paymentMethod.toLowerCase()) + "\"," +
                    "\"amount\":" + cleanAmount + "," +
                    "\"senderNumber\":\"" + escapeJson(record.senderNumber != null ? record.senderNumber : "") + "\"," +
                    "\"status\":\"SYNCED\"," +
                    "\"receivedAt\":" + record.createdAt + "," +
                    "\"syncedAt\":" + System.currentTimeMillis() +
                    "}";

            byte[] body = rtdbPayload.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
                os.flush();
            }

            int statusCode = conn.getResponseCode();
            if (statusCode >= 200 && statusCode < 300) {
                addDiagnosticLog("Firebase sync success\nTransaction ID: " + cleanTrx + "\nAmount: " + cleanAmount + "\nPath: " + targetPath);
                return true;
            } else {
                addDiagnosticLog("Firebase sync failed\nTransaction ID: " + cleanTrx + "\nError: HTTP " + statusCode);
            }
        } catch (Exception e) {
            String safeMsg = e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage() : "");
            addDiagnosticLog("Firebase sync failed\nTransaction ID: " + cleanTrx + "\nError: " + safeMsg);
        } finally {
            if (conn != null) conn.disconnect();
        }
        return false;
    }

    /**
     * Executes write using Firebase Realtime Database SDK if available on runtime classpath.
     */
    private static boolean uploadViaFirebaseSdk(PendingPaymentRecord record, Context context, String cleanTrx, String cleanAmount, String targetPath) {
        try {
            Class<?> firebaseAppClass = Class.forName("com.google.firebase.FirebaseApp");
            if (context != null) {
                java.lang.reflect.Method getApps = firebaseAppClass.getMethod("getApps", Context.class);
                java.util.List<?> apps = (java.util.List<?>) getApps.invoke(null, context);
                if (apps == null || apps.isEmpty()) {
                    Class<?> optionsBuilderClass = Class.forName("com.google.firebase.FirebaseOptions$Builder");
                    Object builder = optionsBuilderClass.getDeclaredConstructor().newInstance();
                    java.lang.reflect.Method setProjectId = optionsBuilderClass.getMethod("setProjectId", String.class);
                    setProjectId.invoke(builder, "rjworldbdcom");
                    java.lang.reflect.Method setDbUrl = optionsBuilderClass.getMethod("setDatabaseUrl", String.class);
                    setDbUrl.invoke(builder, "https://rjworldbdcom-default-rtdb.firebaseio.com/");
                    java.lang.reflect.Method buildMethod = optionsBuilderClass.getMethod("build");
                    Object options = buildMethod.invoke(builder);
                    java.lang.reflect.Method initMethod = firebaseAppClass.getMethod("initializeApp", Context.class, Class.forName("com.google.firebase.FirebaseOptions"));
                    initMethod.invoke(null, context, options);
                }
            }

            Class<?> dbClass = Class.forName("com.google.firebase.database.FirebaseDatabase");
            java.lang.reflect.Method getInstance = dbClass.getMethod("getInstance", String.class);
            Object dbInstance = getInstance.invoke(null, "https://rjworldbdcom-default-rtdb.firebaseio.com/");

            java.lang.reflect.Method getRef = dbClass.getMethod("getReference", String.class);
            Object rootRef = getRef.invoke(dbInstance, "payments");

            Class<?> refClass = Class.forName("com.google.firebase.database.DatabaseReference");
            java.lang.reflect.Method pushMethod = refClass.getMethod("push");
            Object pushedRef = pushMethod.invoke(rootRef);

            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("transactionId", cleanTrx);
            map.put("paymentMethod", record.paymentMethod != null ? record.paymentMethod.toLowerCase() : "bkash");
            map.put("amount", record.receivedAmount);
            map.put("senderNumber", record.senderNumber != null ? record.senderNumber : "");
            map.put("status", "SYNCED");
            map.put("receivedAt", record.createdAt);
            map.put("syncedAt", System.currentTimeMillis());

            java.lang.reflect.Method setValueMethod = refClass.getMethod("setValue", Object.class);
            Object task = setValueMethod.invoke(pushedRef, map);

            Class<?> tasksClass = Class.forName("com.google.android.gms.tasks.Tasks");
            java.lang.reflect.Method awaitMethod = tasksClass.getMethod("await", Class.forName("com.google.android.gms.tasks.Task"), long.class, java.util.concurrent.TimeUnit.class);
            awaitMethod.invoke(null, task, 8000L, java.util.concurrent.TimeUnit.MILLISECONDS);

            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Checks if a transaction has been marked as verified on the website via RTDB.
     */
    private static boolean checkPaymentVerifiedOnWebsite(String trxId) {
        HttpURLConnection conn = null;
        try {
            String cleanTrx = trxId.trim().toUpperCase();
            String rtdbUrl = FIREBASE_RTDB_BASE_URL + "/" + cleanTrx + ".json";
            URL url = new URL(rtdbUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            int statusCode = conn.getResponseCode();
            if (statusCode >= 200 && statusCode < 300) {
                String body = readStream(conn.getInputStream());
                if (body != null && (body.contains("\"status\":\"verified\"") || body.contains("\"verificationStatus\":\"verified\""))) {
                    return true;
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return false;
    }

    /**
     * Uploads a single payment record, trying candidate endpoints sequentially until success.
     * Logs exact URL, HTTP status, and server response.
     */
    private static boolean uploadPaymentToServer(PendingPaymentRecord record, List<String> endpoints) {
        String cleanTrx = record.transactionId != null ? record.transactionId.trim().toUpperCase() : "";
        String jsonPayload = "{" +
                "\"transactionId\":\"" + escapeJson(cleanTrx) + "\"," +
                "\"paymentMethod\":\"" + escapeJson(record.paymentMethod.toLowerCase()) + "\"," +
                "\"amount\":" + record.receivedAmount + "," +
                "\"receivedAmount\":" + record.receivedAmount + "," +
                "\"senderNumber\":\"" + escapeJson(record.senderNumber != null ? record.senderNumber : "") + "\"," +
                "\"timestamp\":" + record.createdAt + "," +
                "\"paymentId\":\"" + escapeJson(record.paymentId) + "\"," +
                "\"source\":\"RJ World BD SMS Reader Android App\"," +
                "\"status\":\"pending\"," +
                "\"verificationStatus\":\"pending\"," +
                "\"paymentAvailability\":\"available\"" +
                "}";

        for (String endpointUrl : endpoints) {
            HttpURLConnection conn = null;
            try {
                addDiagnosticLog("Trying URL: " + endpointUrl);
                URL url = new URL(endpointUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("X-App-Source", "RJ-World-BD-Android-SMS-Reader");
                conn.setConnectTimeout(12000);
                conn.setReadTimeout(12000);
                conn.setDoOutput(true);

                byte[] body = jsonPayload.getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body);
                    os.flush();
                }

                int statusCode = conn.getResponseCode();
                String responseBody = readStream(statusCode >= 200 && statusCode < 400 ? conn.getInputStream() : conn.getErrorStream());

                addDiagnosticLog("HTTP " + statusCode + " from " + endpointUrl);
                if (responseBody != null && !responseBody.trim().isEmpty()) {
                    addDiagnosticLog("SERVER RESPONSE: " + responseBody.trim());
                }

                if (statusCode >= 200 && statusCode < 300) {
                    return true;
                }
            } catch (Exception e) {
                addDiagnosticLog("ERROR contacting " + endpointUrl + ": " + e.getClass().getSimpleName() + " - " + e.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }
        return false;
    }

    private static String readStream(InputStream is) {
        if (is == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
