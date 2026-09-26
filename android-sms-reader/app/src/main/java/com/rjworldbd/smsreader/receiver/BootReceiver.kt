package com.rjworldbd.smsreader.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.rjworldbd.smsreader.service.SmsReaderForegroundService

/**
 * Automatically starts SmsReaderForegroundService on device boot or app update
 * to ensure persistent background SMS monitoring without requiring user to open the app.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            
            // Start Foreground Service with persistent notification
            SmsReaderForegroundService.start(context)
        }
    }
}
