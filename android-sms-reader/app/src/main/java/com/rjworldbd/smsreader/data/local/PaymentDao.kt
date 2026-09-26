package com.rjworldbd.smsreader.data.local

import androidx.room.*
import com.rjworldbd.smsreader.data.model.PaymentVerificationEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PaymentDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(payment: PaymentVerificationEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(payments: List<PaymentVerificationEntity>)

    @Query("SELECT * FROM payments ORDER BY createdAt DESC")
    fun getAllPaymentsFlow(): Flow<List<PaymentVerificationEntity>>

    @Query("SELECT * FROM payments WHERE syncStatus != 'synced' ORDER BY createdAt ASC")
    suspend fun getPendingSyncPayments(): List<PaymentVerificationEntity>

    @Query("SELECT COUNT(*) FROM payments")
    fun getTotalCountFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM payments WHERE status = 'pending'")
    fun getPendingCountFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM payments WHERE status = 'pending'")
    suspend fun getPendingCount(): Int

    @Query("SELECT COUNT(*) FROM payments WHERE syncStatus = 'synced'")
    fun getSyncedCountFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM payments WHERE syncStatus = 'synced'")
    suspend fun getSyncedCount(): Int

    @Query("SELECT COUNT(*) FROM payments WHERE status = 'verified'")
    fun getVerifiedCountFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM payments WHERE status = 'rejected'")
    fun getRejectedCountFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM payments WHERE syncStatus != 'synced'")
    fun getPendingSyncCountFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM payments WHERE syncStatus != 'synced'")
    suspend fun getPendingSyncCount(): Int

    @Query("SELECT * FROM payments WHERE UPPER(transactionId) = UPPER(:trxId) LIMIT 1")
    suspend fun findByTransactionId(trxId: String): PaymentVerificationEntity?

    @Query("UPDATE payments SET syncStatus = 'synced' WHERE paymentId = :paymentId")
    suspend fun markAsSynced(paymentId: String)

    @Query("UPDATE payments SET status = :status, verifiedAt = :verifiedAt, rejectionReason = :rejectionReason WHERE paymentId = :paymentId")
    suspend fun updateVerificationResult(paymentId: String, status: String, verifiedAt: Long?, rejectionReason: String?)
}
