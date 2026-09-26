package com.rjworldbd.smsreader.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room Database Entity for local offline transaction persistence and queuing.
 * Exactly compatible with Firebase payments schema.
 */
@Entity(tableName = "payments")
data class PaymentVerificationEntity(
    @PrimaryKey
    val paymentId: String,
    val invoiceId: String,
    val userId: String,
    val userType: String, // 'customer', 'reseller', 'vendor'
    val paymentMethod: String, // 'bkash', 'nagad', 'rocket', 'upay'
    val expectedAmount: Double,
    val transactionId: String,
    val status: String, // 'pending', 'verified', 'rejected'
    val senderNumber: String?,
    val receivedAmount: Double?,
    val verifiedAt: Long?,
    val createdAt: Long,
    val rejectionReason: String?,
    val syncStatus: String = "pending_sync", // 'synced', 'pending_sync', 'sync_failed'
    val isOfflineCreated: Boolean = false
)
