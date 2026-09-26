package com.rjworldbd.smsreader.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.*
import com.rjworldbd.smsreader.data.local.PaymentDatabase
import com.rjworldbd.smsreader.data.model.PaymentVerificationEntity
import com.rjworldbd.smsreader.parser.PaymentSmsParser
import com.rjworldbd.smsreader.sync.PaymentSyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * BroadcastReceiver for incoming SMS.
 * STRICT RULES:
 * 1. Only processes bKash, Nagad, Rocket, Upay payment SMS.
 * 2. All other SMS are ignored immediately.
 * 3. Never stores or uploads full SMS body.
 * 4. Checks duplicate TrxID to prevent double submission.
 * 5. Queues into local Room database and triggers WorkManager sync.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        // Extract sender and combined body
        val sender = messages[0].originatingAddress ?: return
        val bodyBuilder = StringBuilder()
        var timestamp = System.currentTimeMillis()

        for (msg in messages) {
            bodyBuilder.append(msg.messageBody)
            timestamp = msg.timestampMillis
        }
        val fullBody = bodyBuilder.toString()

        // Step 1: Parse and detect strictly supported payment SMS
        val parsed = PaymentSmsParser.parse(sender, fullBody, timestamp) ?: return // Ignore non-payment SMS

        // Step 2: Coroutine for local database operations
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val db = PaymentDatabase.getInstance(context)
                val dao = db.paymentDao()

                // Duplicate Check by Transaction ID across ALL stored transactions
                val existing = dao.findByTransactionId(parsed.transactionId)
                if (existing != null) {
                    if (existing.syncStatus == "pending_sync") {
                        val constraints = Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED)
                            .build()
                        val syncRequest = OneTimeWorkRequestBuilder<PaymentSyncWorker>()
                            .setConstraints(constraints)
                            .build()
                        WorkManager.getInstance(context).enqueue(syncRequest)
                    }
                    return@launch
                }

                val paymentId = "PAY-${System.currentTimeMillis().toString(36).uppercase()}"
                val invoiceId = "INV-${(System.currentTimeMillis() % 1000000)}"

                val entity = PaymentVerificationEntity(
                    paymentId = paymentId,
                    invoiceId = invoiceId,
                    userId = "android_sms_detected",
                    userType = "customer",
                    paymentMethod = parsed.paymentMethod,
                    expectedAmount = parsed.amount,
                    transactionId = parsed.transactionId,
                    status = "pending",
                    senderNumber = parsed.senderNumber,
                    receivedAmount = parsed.amount,
                    verifiedAt = null,
                    createdAt = parsed.timestamp,
                    rejectionReason = null,
                    syncStatus = "pending_sync",
                    isOfflineCreated = false
                )

                // Save to local queue
                dao.insertOrUpdate(entity)

                // Update Persistent Notification with current pending and synced count
                val pendingCount = dao.getPendingCount()
                val syncedCount = dao.getSyncedCount()
                com.rjworldbd.smsreader.service.SmsReaderForegroundService.updateCounts(context, pendingCount, syncedCount)

                // Trigger network sync worker (WorkManager with network constraint)
                val constraints = Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()

                val syncRequest = OneTimeWorkRequestBuilder<PaymentSyncWorker>()
                    .setConstraints(constraints)
                    .build()

                WorkManager.getInstance(context).enqueue(syncRequest)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
