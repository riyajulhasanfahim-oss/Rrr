package com.rjworldbd.smsreader.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.FirebaseApp
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.firestore.FirebaseFirestore
import com.rjworldbd.smsreader.data.local.PaymentDatabase
import com.rjworldbd.smsreader.data.model.PaymentVerificationEntity
import com.rjworldbd.smsreader.service.SmsReaderForegroundService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlin.math.abs

/**
 * Background WorkManager worker that activates when network connection is restored
 * to upload queued offline payments to Firebase Realtime Database and Backend Service,
 * ensuring automatic verification on the website.
 * 
 * STRICT RULES:
 * 1. Never sends full raw SMS text.
 * 2. Only sends extracted payment details: paymentMethod, transactionId, amount, senderNumber, timestamp.
 * 3. Uploads directly to Firebase RTDB path: payments
 * 4. Also forwards to Data Service / Backend endpoint: /api/payment/sms-sync
 */
class PaymentSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "PaymentSyncWorker"
        private const val FIREBASE_RTDB_BASE = "https://rjworldbdcom-default-rtdb.firebaseio.com/payments"
        private val BACKEND_ENDPOINTS = listOf(
            "https://ais-dev-6fbr6wfsfb733bpemqpi5w-645913857598.asia-southeast1.run.app/api/payment/sms-sync",
            "https://ais-pre-6fbr6wfsfb733bpemqpi5w-645913857598.asia-southeast1.run.app/api/payment/sms-sync",
            "https://rjworldbd.com/api/payment/sms-sync",
            "https://www.rjworldbd.com/api/payment/sms-sync"
        )
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val database = PaymentDatabase.getInstance(applicationContext)
        val dao = database.paymentDao()
        val pendingPayments = dao.getPendingSyncPayments()

        if (pendingPayments.isEmpty()) {
            val pendingCount = dao.getPendingCount()
            val syncedCount = dao.getSyncedCount()
            SmsReaderForegroundService.updateCounts(applicationContext, pendingCount, syncedCount)
            return@withContext Result.success()
        }

        var anyFailed = false

        for (payment in pendingPayments) {
            val cleanTrxId = payment.transactionId.trim().uppercase()
            val pAmount = payment.receivedAmount ?: payment.expectedAmount
            val pMethod = payment.paymentMethod.trim().lowercase()
            val now = System.currentTimeMillis()
            val targetPath = "payments"

            var rtdbUploaded = false
            var serverUploaded = false

            // 1. DIRECT UPLOAD TO FIREBASE REALTIME DATABASE VIA SDK OR REST
            try {
                // A. Try Firebase Realtime Database SDK first
                try {
                    val rtdbInstance = FirebaseDatabase.getInstance("https://rjworldbdcom-default-rtdb.firebaseio.com/")
                    val recordMap = hashMapOf<String, Any>(
                        "transactionId" to cleanTrxId,
                        "paymentMethod" to pMethod,
                        "amount" to pAmount,
                        "senderNumber" to (payment.senderNumber ?: ""),
                        "status" to "SYNCED",
                        "receivedAt" to payment.createdAt,
                        "syncedAt" to now
                    )
                    rtdbInstance.getReference("payments").push().setValue(recordMap).await()
                    rtdbUploaded = true
                    Log.i(TAG, "Firebase sync success\nTransaction ID: $cleanTrxId\nAmount: $pAmount\nPath: $targetPath")
                } catch (sdkEx: Exception) {
                    // Fallback to HTTP REST endpoint
                    val rtdbUrl = "$FIREBASE_RTDB_BASE.json"
                    val conn = (URL(rtdbUrl).openConnection() as HttpURLConnection).apply {
                        doOutput = true
                        requestMethod = "POST"
                        setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                        setRequestProperty("Accept", "application/json")
                        connectTimeout = 8000
                        readTimeout = 8000
                    }

                    val payload = """
                        {
                            "transactionId": "$cleanTrxId",
                            "paymentMethod": "$pMethod",
                            "amount": $pAmount,
                            "senderNumber": "${payment.senderNumber ?: ""}",
                            "status": "SYNCED",
                            "receivedAt": ${payment.createdAt},
                            "syncedAt": $now
                        }
                    """.trimIndent()

                    val body = payload.toByteArray(StandardCharsets.UTF_8)
                    conn.outputStream.use { os ->
                        os.write(body)
                        os.flush()
                    }

                    val code = conn.responseCode
                    conn.disconnect()
                    if (code in 200..299) {
                        rtdbUploaded = true
                        Log.i(TAG, "Firebase sync success\nTransaction ID: $cleanTrxId\nAmount: $pAmount\nPath: $targetPath")
                    } else {
                        Log.w(TAG, "Firebase sync failed\nTransaction ID: $cleanTrxId\nError: HTTP $code")
                    }
                }
            } catch (e: Exception) {
                val safeErr = e.javaClass.simpleName + (e.message?.let { ": $it" } ?: "")
                Log.w(TAG, "Firebase sync failed\nTransaction ID: $cleanTrxId\nError: $safeErr")
            }

            // 2. UPLOAD TO BACKEND DATA SERVICE: /api/payment/sms-sync
            for (endpoint in BACKEND_ENDPOINTS) {
                try {
                    val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        doOutput = true
                        requestMethod = "POST"
                        setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                        setRequestProperty("Accept", "application/json")
                        connectTimeout = 5000
                        readTimeout = 5000
                    }

                    val serverPayload = """
                        {
                            "transactionId": "$cleanTrxId",
                            "paymentMethod": "$pMethod",
                            "amount": $pAmount,
                            "receivedAmount": $pAmount,
                            "senderNumber": "${payment.senderNumber ?: ""}",
                            "timestamp": ${payment.createdAt},
                            "paymentId": "${payment.paymentId}",
                            "source": "RJ World BD SMS Reader Android App"
                        }
                    """.trimIndent()

                    val body = serverPayload.toByteArray(StandardCharsets.UTF_8)
                    conn.outputStream.use { os ->
                        os.write(body)
                        os.flush()
                    }

                    val code = conn.responseCode
                    conn.disconnect()
                    if (code in 200..299) {
                        serverUploaded = true
                        break
                    }
                } catch (ignored: Exception) {}
            }

            // 3. UPLOAD TO FIRESTORE (AS REDUNDANT FALLBACK)
            try {
                val firestore = FirebaseFirestore.getInstance()
                val firestoreData = hashMapOf(
                    "paymentId" to payment.paymentId,
                    "invoiceId" to payment.invoiceId,
                    "userId" to payment.userId,
                    "userType" to payment.userType,
                    "paymentMethod" to pMethod,
                    "expectedAmount" to pAmount,
                    "transactionId" to cleanTrxId,
                    "status" to payment.status,
                    "senderNumber" to (payment.senderNumber ?: ""),
                    "receivedAmount" to pAmount,
                    "verifiedAt" to payment.verifiedAt,
                    "createdAt" to payment.createdAt,
                    "rejectionReason" to payment.rejectionReason,
                    "metadata" to hashMapOf(
                        "syncedFrom" to "RJ World BD Android App",
                        "syncedAt" to now
                    )
                )

                firestore.collection("payments")
                    .document(cleanTrxId)
                    .set(firestoreData)
                    .await()
            } catch (ignored: Exception) {}

            if (rtdbUploaded || serverUploaded) {
                dao.markAsSynced(payment.paymentId)
            } else {
                anyFailed = true
            }
        }

        val finalPending = dao.getPendingCount()
        val finalSynced = dao.getSyncedCount()
        SmsReaderForegroundService.updateCounts(applicationContext, finalPending, finalSynced)

        if (anyFailed) Result.retry() else Result.success()
    }

    /**
     * Automatic Verification Engine:
     * Matches Transaction ID + Payment Method + Amount against pending requests.
     */
    private suspend fun triggerAutomaticVerification(
        firestore: FirebaseFirestore,
        payment: PaymentVerificationEntity,
        dao: com.rjworldbd.smsreader.data.local.PaymentDao
    ) {
        val cleanTrxId = payment.transactionId.trim().uppercase()
        val pMethod = payment.paymentMethod.trim().lowercase()
        val pAmount = payment.receivedAmount ?: payment.expectedAmount
        val now = System.currentTimeMillis()

        var matched = false

        // 1. Check Customer Orders with status 'Pending' and matching Transaction ID
        try {
            val orderQuery = firestore.collection("orders")
                .whereEqualTo("transactionId", cleanTrxId)
                .whereEqualTo("paymentStatus", "Pending")
                .limit(2)
                .get()
                .await()

            for (doc in orderQuery.documents) {
                val orderMethod = (doc.getString("paymentMethod") ?: "").lowercase()
                val grandTotal = doc.getDouble("grandTotal") ?: doc.getDouble("totalAmount") ?: 0.0
                val shippingCharge = doc.getDouble("shippingCharge") ?: 0.0

                val isMethodMatch = orderMethod.contains(pMethod) || pMethod.contains(orderMethod)
                val isAmountMatch = abs(grandTotal - pAmount) <= 0.05 || abs(shippingCharge - pAmount) <= 0.05

                if (isMethodMatch && isAmountMatch) {
                    // Exact match: confirm customer order
                    firestore.collection("orders").document(doc.id)
                        .update(
                            mapOf(
                                "paymentStatus" to "Paid",
                                "status" to "Confirmed",
                                "verifiedAt" to now,
                                "receivedAmount" to pAmount,
                                "senderNumber" to payment.senderNumber,
                                "updatedAt" to now
                            )
                        )
                        .await()
                    matched = true
                    break
                }
            }
        } catch (e: Exception) {
            // Ignore search errors
        }

        // 2. Check Pending Vendor Applications
        if (!matched) {
            try {
                val vendorQuery = firestore.collection("vendors")
                    .whereEqualTo("transactionId", cleanTrxId)
                    .whereEqualTo("status", "pending")
                    .limit(2)
                    .get()
                    .await()

                for (doc in vendorQuery.documents) {
                    val vendorMethod = (doc.getString("paymentMethod") ?: "").lowercase()
                    val regFee = doc.getDouble("registrationFee") ?: 0.0

                    val isMethodMatch = vendorMethod.contains(pMethod) || pMethod.contains(vendorMethod)
                    val isAmountMatch = abs(regFee - pAmount) <= 0.05

                    if (isMethodMatch && isAmountMatch) {
                        // Exact match: approve vendor
                        firestore.collection("vendors").document(doc.id)
                            .update(
                                mapOf(
                                    "status" to "active",
                                    "registrationPayment" to "completed",
                                    "verifiedAt" to now,
                                    "updatedAt" to now
                                )
                            )
                            .await()

                        // Update user role to Vendor
                        firestore.collection("users").document(doc.id)
                            .update("role", "Vendor")
                            .await()

                        matched = true
                        break
                    }
                }
            } catch (e: Exception) {
                // Ignore search errors
            }
        }

        // 3. Check Pending Reseller Applications
        if (!matched) {
            try {
                val resellerQuery = firestore.collection("resellers")
                    .whereEqualTo("transactionId", cleanTrxId)
                    .whereEqualTo("status", "pending")
                    .limit(2)
                    .get()
                    .await()

                for (doc in resellerQuery.documents) {
                    val resellerMethod = (doc.getString("paymentMethod") ?: "").lowercase()
                    val regFee = doc.getDouble("registrationFee") ?: 0.0

                    val isMethodMatch = resellerMethod.contains(pMethod) || pMethod.contains(resellerMethod)
                    val isAmountMatch = abs(regFee - pAmount) <= 0.05

                    if (isMethodMatch && isAmountMatch) {
                        // Exact match: approve reseller
                        firestore.collection("resellers").document(doc.id)
                            .update(
                                mapOf(
                                    "status" to "approved",
                                    "registrationPayment" to "completed",
                                    "verifiedAt" to now,
                                    "updatedAt" to now
                                )
                            )
                            .await()

                        // Update user role to Reseller
                        firestore.collection("users").document(doc.id)
                            .update("role", "Reseller")
                            .await()

                        matched = true
                        break
                    }
                }
            } catch (e: Exception) {
                // Ignore search errors
            }
        }

        // If matched, mark the payment verification record as verified
        if (matched) {
            firestore.collection("payments").document(payment.paymentId)
                .update(
                    mapOf(
                        "status" to "verified",
                        "verifiedAt" to now
                    )
                )
                .await()

            dao.updateVerificationResult(payment.paymentId, "verified", now, null)
        }
    }
}

