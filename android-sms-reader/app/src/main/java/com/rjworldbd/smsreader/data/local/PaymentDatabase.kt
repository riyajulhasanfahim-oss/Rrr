package com.rjworldbd.smsreader.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.rjworldbd.smsreader.data.model.PaymentVerificationEntity

/**
 * Room Database for offline transaction storage and syncing.
 * Provides local persistent queue when device is offline.
 */
@Database(
    entities = [PaymentVerificationEntity::class],
    version = 1,
    exportSchema = false
)
abstract class PaymentDatabase : RoomDatabase() {

    abstract fun paymentDao(): PaymentDao

    companion object {
        @Volatile
        private var INSTANCE: PaymentDatabase? = null

        fun getInstance(context: Context): PaymentDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    PaymentDatabase::class.java,
                    "rj_world_bd_payment_db"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
