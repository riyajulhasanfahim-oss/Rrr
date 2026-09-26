package com.rjworldbd.smsreader

import android.app.Application
import com.rjworldbd.smsreader.data.local.PaymentDatabase
import com.rjworldbd.smsreader.service.SmsReaderForegroundService

/**
 * Application entry point for RJ World BD SMS Reader.
 * Initializes Room database and triggers persistent foreground service if permissions granted.
 */
class RjWorldBdApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // Initialize local Room database
        PaymentDatabase.getInstance(this)

        // Start Foreground Service for continuous background monitoring
        try {
            SmsReaderForegroundService.start(this)
        } catch (e: Exception) {
            // Android 14+ may require permission before foreground service start from Application
        }
    }
}
