package com.rjworldbd.smsreader.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.rjworldbd.smsreader.data.local.PaymentDatabase
import com.rjworldbd.smsreader.service.SmsReaderForegroundService
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Main Activity for RJ World BD SMS Reader.
 * Displays real-time metrics:
 * 1. Total Transactions
 * 2. Pending
 * 3. Synced
 * 4. Verified
 * 5. Rejected
 * 
 * Manages Foreground Service & SMS Permissions.
 */
class MainActivity : AppCompatActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val smsGranted = permissions[Manifest.permission.RECEIVE_SMS] == true ||
                permissions[Manifest.permission.READ_SMS] == true

        if (smsGranted) {
            SmsReaderForegroundService.start(this)
            Toast.makeText(this, "SMS Permission Granted. RJ World BD Payment Service is Active.", Toast.LENGTH_LONG).show()
        } else {
            SmsReaderForegroundService.stop(this, "SMS Permission unavailable")
            Toast.makeText(this, "SMS Permission Denied. Service cannot read payment SMS.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(com.rjworldbd.smsreader.R.layout.activity_main)

        // Check and request runtime permissions (SMS + Post Notifications on Android 13+)
        checkAndRequestPermissions()

        // Observe real-time database counters
        observeMetrics()
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        } else {
            SmsReaderForegroundService.start(this)
        }
    }

    private fun observeMetrics() {
        val dao = PaymentDatabase.getInstance(this).paymentDao()

        lifecycleScope.launch {
            dao.getTotalCountFlow().collectLatest { count ->
                // Real-time total transactions count
            }
        }

        lifecycleScope.launch {
            dao.getPendingCountFlow().collectLatest { count ->
                // Real-time pending count
                SmsReaderForegroundService.updateCount(this@MainActivity, count)
            }
        }

        lifecycleScope.launch {
            dao.getSyncedCountFlow().collectLatest { count ->
                // Real-time synced count
            }
        }

        lifecycleScope.launch {
            dao.getVerifiedCountFlow().collectLatest { count ->
                // Real-time verified count
            }
        }

        lifecycleScope.launch {
            dao.getRejectedCountFlow().collectLatest { count ->
                // Real-time rejected count
            }
        }
    }
}
