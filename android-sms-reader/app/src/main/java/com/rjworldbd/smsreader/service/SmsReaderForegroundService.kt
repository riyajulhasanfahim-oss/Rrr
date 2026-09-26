package com.rjworldbd.smsreader.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.rjworldbd.smsreader.R
import com.rjworldbd.smsreader.ui.MainActivity

/**
 * Foreground Service that keeps RJ World BD SMS Reader active in the background
 * and displays a persistent, non-dismissible notification in the status bar.
 */
class SmsReaderForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "rj_world_bd_payment_service_channel"
        const val NOTIFICATION_ID = 1001
        const val INACTIVE_NOTIFICATION_ID = 1002
        const val ACTION_START = "ACTION_START_SERVICE"
        const val ACTION_STOP = "ACTION_STOP_SERVICE"
        const val ACTION_UPDATE_COUNT = "ACTION_UPDATE_PENDING_COUNT"
        const val ACTION_SHOW_INACTIVE = "ACTION_SHOW_INACTIVE"
        const val EXTRA_PENDING_COUNT = "EXTRA_PENDING_COUNT"
        const val EXTRA_SYNCED_COUNT = "EXTRA_SYNCED_COUNT"
        const val EXTRA_INACTIVE_REASON = "EXTRA_INACTIVE_REASON"

        fun start(context: Context) {
            val intent = Intent(context, SmsReaderForegroundService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context, reason: String = "Service বন্ধ অথবা অনুমতি পাওয়া যায়নি") {
            val intent = Intent(context, SmsReaderForegroundService::class.java).apply {
                action = ACTION_STOP
                putExtra(EXTRA_INACTIVE_REASON, reason)
            }
            context.startService(intent)
        }

        fun updateCounts(context: Context, pendingCount: Int, syncedCount: Int) {
            val intent = Intent(context, SmsReaderForegroundService::class.java).apply {
                action = ACTION_UPDATE_COUNT
                putExtra(EXTRA_PENDING_COUNT, pendingCount)
                putExtra(EXTRA_SYNCED_COUNT, syncedCount)
            }
            context.startService(intent)
        }

        fun updateCount(context: Context, count: Int) {
            updateCounts(context, count, 0)
        }
    }

    private var pendingTransactionsCount = 0
    private var syncedTransactionsCount = 0

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                val reason = intent.getStringExtra(EXTRA_INACTIVE_REASON) ?: "Service বন্ধ অথবা অনুমতি নেই"
                showInactiveNotification(reason)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_COUNT -> {
                pendingTransactionsCount = intent.getIntExtra(EXTRA_PENDING_COUNT, pendingTransactionsCount)
                syncedTransactionsCount = intent.getIntExtra(EXTRA_SYNCED_COUNT, syncedTransactionsCount)
                updateNotification()
            }
            ACTION_SHOW_INACTIVE -> {
                val reason = intent.getStringExtra(EXTRA_INACTIVE_REASON) ?: "Service বন্ধ"
                showInactiveNotification(reason)
            }
            else -> {
                startForeground(NOTIFICATION_ID, buildActiveNotification())
            }
        }
        return START_STICKY
    }

    private fun buildActiveNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Notification format strictly as requested:
        // Title: RJ World BD Payment Service
        // Subtitle: Pending: X | Synced: X
        val contentText = "Pending: $pendingTransactionsCount | Synced: $syncedTransactionsCount"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("RJ World BD Payment Service")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true) // Persistent, non-dismissible while active
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun showInactiveNotification(reason: String) {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val inactiveNotification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("RJ World BD Payment Service — Inactive")
            .setContentText(reason)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setOngoing(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(INACTIVE_NOTIFICATION_ID, inactiveNotification)
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildActiveNotification())
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "RJ World BD Payment Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows persistent status of RJ World BD SMS Reader Service"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
