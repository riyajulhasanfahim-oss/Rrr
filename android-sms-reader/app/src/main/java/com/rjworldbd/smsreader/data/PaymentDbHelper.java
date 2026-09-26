package com.rjworldbd.smsreader.data;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import com.rjworldbd.smsreader.parser.PaymentSmsParser.ParsedPayment;
import java.util.ArrayList;
import java.util.List;

public class PaymentDbHelper extends SQLiteOpenHelper {

    private static final String DATABASE_NAME = "rj_world_bd_payments.db";
    private static final int DATABASE_VERSION = 1;

    public static final String TABLE_PAYMENTS = "payments";
    public static final String COL_ID = "id";
    public static final String COL_PAYMENT_ID = "payment_id";
    public static final String COL_INVOICE_ID = "invoice_id";
    public static final String COL_USER_ID = "user_id";
    public static final String COL_USER_TYPE = "user_type";
    public static final String COL_PAYMENT_METHOD = "payment_method";
    public static final String COL_EXPECTED_AMOUNT = "expected_amount";
    public static final String COL_TRANSACTION_ID = "transaction_id";
    public static final String COL_STATUS = "status";
    public static final String COL_SENDER_NUMBER = "sender_number";
    public static final String COL_RECEIVED_AMOUNT = "received_amount";
    public static final String COL_CREATED_AT = "created_at";
    public static final String COL_SYNC_STATUS = "sync_status";

    private static PaymentDbHelper instance;

    public static synchronized PaymentDbHelper getInstance(Context context) {
        if (instance == null) {
            instance = new PaymentDbHelper(context.getApplicationContext());
        }
        return instance;
    }

    private PaymentDbHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        String createTable = "CREATE TABLE " + TABLE_PAYMENTS + " (" +
                COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                COL_PAYMENT_ID + " TEXT UNIQUE, " +
                COL_INVOICE_ID + " TEXT, " +
                COL_USER_ID + " TEXT, " +
                COL_USER_TYPE + " TEXT, " +
                COL_PAYMENT_METHOD + " TEXT, " +
                COL_EXPECTED_AMOUNT + " REAL, " +
                COL_TRANSACTION_ID + " TEXT UNIQUE, " +
                COL_STATUS + " TEXT, " +
                COL_SENDER_NUMBER + " TEXT, " +
                COL_RECEIVED_AMOUNT + " REAL, " +
                COL_CREATED_AT + " INTEGER, " +
                COL_SYNC_STATUS + " TEXT" +
                ");";
        db.execSQL(createTable);
        db.execSQL("CREATE UNIQUE INDEX idx_trx_id ON " + TABLE_PAYMENTS + " (" + COL_TRANSACTION_ID + ");");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_PAYMENTS);
        onCreate(db);
    }

    public synchronized boolean hasTransaction(String trxId) {
        if (trxId == null) return false;
        SQLiteDatabase db = getReadableDatabase();
        Cursor cursor = db.query(TABLE_PAYMENTS, new String[]{COL_ID},
                COL_TRANSACTION_ID + " = ?", new String[]{trxId}, null, null, null);
        boolean exists = (cursor != null && cursor.getCount() > 0);
        if (cursor != null) cursor.close();
        return exists;
    }

    public synchronized boolean insertParsedPayment(ParsedPayment payment) {
        if (payment == null || hasTransaction(payment.transactionId)) {
            return false; // Prevent duplicate
        }
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        String paymentId = "PAY-" + Long.toString(System.currentTimeMillis(), 36).toUpperCase();
        String invoiceId = "INV-" + (System.currentTimeMillis() % 1000000);

        cv.put(COL_PAYMENT_ID, paymentId);
        cv.put(COL_INVOICE_ID, invoiceId);
        cv.put(COL_USER_ID, "android_sms_detected");
        cv.put(COL_USER_TYPE, "customer");
        cv.put(COL_PAYMENT_METHOD, payment.paymentMethod);
        cv.put(COL_EXPECTED_AMOUNT, payment.amount);
        cv.put(COL_TRANSACTION_ID, payment.transactionId);
        cv.put(COL_STATUS, "pending");
        cv.put(COL_SENDER_NUMBER, payment.senderNumber);
        cv.put(COL_RECEIVED_AMOUNT, payment.amount);
        cv.put(COL_CREATED_AT, payment.timestamp);
        cv.put(COL_SYNC_STATUS, "pending_sync");

        long row = db.insertWithOnConflict(TABLE_PAYMENTS, null, cv, SQLiteDatabase.CONFLICT_IGNORE);
        return row != -1;
    }

    public synchronized int getPendingCount() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM " + TABLE_PAYMENTS + " WHERE " + COL_STATUS + " = 'pending'", null);
        int count = 0;
        if (c.moveToFirst()) count = c.getInt(0);
        c.close();
        return count;
    }

    public synchronized int getSyncedCount() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM " + TABLE_PAYMENTS + " WHERE " + COL_STATUS + " = 'verified'", null);
        int count = 0;
        if (c.moveToFirst()) count = c.getInt(0);
        c.close();
        return count;
    }

    public synchronized int getTotalCount() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM " + TABLE_PAYMENTS, null);
        int count = 0;
        if (c.moveToFirst()) count = c.getInt(0);
        c.close();
        return count;
    }

    public static class PendingPaymentRecord {
        public final String paymentId;
        public final String invoiceId;
        public final String userId;
        public final String userType;
        public final String paymentMethod;
        public final double expectedAmount;
        public final String transactionId;
        public final String status;
        public final String senderNumber;
        public final double receivedAmount;
        public final long createdAt;
        public final String syncStatus;

        public PendingPaymentRecord(String paymentId, String invoiceId, String userId, String userType,
                                    String paymentMethod, double expectedAmount, String transactionId,
                                    String status, String senderNumber, double receivedAmount,
                                    long createdAt, String syncStatus) {
            this.paymentId = paymentId;
            this.invoiceId = invoiceId;
            this.userId = userId;
            this.userType = userType;
            this.paymentMethod = paymentMethod;
            this.expectedAmount = expectedAmount;
            this.transactionId = transactionId;
            this.status = status;
            this.senderNumber = senderNumber;
            this.receivedAmount = receivedAmount;
            this.createdAt = createdAt;
            this.syncStatus = syncStatus;
        }
    }

    public synchronized List<PendingPaymentRecord> getPendingSyncPayments() {
        return getPendingUploadPayments();
    }

    public synchronized List<PendingPaymentRecord> getPendingUploadPayments() {
        List<PendingPaymentRecord> list = new ArrayList<>();
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.query(TABLE_PAYMENTS, null,
                COL_STATUS + " = 'pending' AND (" + COL_SYNC_STATUS + " = 'pending_sync' OR " + COL_SYNC_STATUS + " IS NULL)",
                null, null, null, COL_CREATED_AT + " ASC", "20");

        if (c != null) {
            while (c.moveToNext()) {
                String paymentId = c.getString(c.getColumnIndexOrThrow(COL_PAYMENT_ID));
                String invoiceId = c.getString(c.getColumnIndexOrThrow(COL_INVOICE_ID));
                String userId = c.getString(c.getColumnIndexOrThrow(COL_USER_ID));
                String userType = c.getString(c.getColumnIndexOrThrow(COL_USER_TYPE));
                String paymentMethod = c.getString(c.getColumnIndexOrThrow(COL_PAYMENT_METHOD));
                double expectedAmount = c.getDouble(c.getColumnIndexOrThrow(COL_EXPECTED_AMOUNT));
                String transactionId = c.getString(c.getColumnIndexOrThrow(COL_TRANSACTION_ID));
                String status = c.getString(c.getColumnIndexOrThrow(COL_STATUS));
                String senderNumber = c.getString(c.getColumnIndexOrThrow(COL_SENDER_NUMBER));
                double receivedAmount = c.getDouble(c.getColumnIndexOrThrow(COL_RECEIVED_AMOUNT));
                long createdAt = c.getLong(c.getColumnIndexOrThrow(COL_CREATED_AT));
                String syncStatus = c.getString(c.getColumnIndexOrThrow(COL_SYNC_STATUS));

                list.add(new PendingPaymentRecord(
                        paymentId, invoiceId, userId, userType, paymentMethod,
                        expectedAmount, transactionId, status, senderNumber,
                        receivedAmount, createdAt, syncStatus
                ));
            }
            c.close();
        }
        return list;
    }

    public synchronized List<PendingPaymentRecord> getPendingVerificationPayments() {
        List<PendingPaymentRecord> list = new ArrayList<>();
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.query(TABLE_PAYMENTS, null,
                COL_STATUS + " = 'pending'",
                null, null, null, COL_CREATED_AT + " ASC", "20");

        if (c != null) {
            while (c.moveToNext()) {
                String paymentId = c.getString(c.getColumnIndexOrThrow(COL_PAYMENT_ID));
                String invoiceId = c.getString(c.getColumnIndexOrThrow(COL_INVOICE_ID));
                String userId = c.getString(c.getColumnIndexOrThrow(COL_USER_ID));
                String userType = c.getString(c.getColumnIndexOrThrow(COL_USER_TYPE));
                String paymentMethod = c.getString(c.getColumnIndexOrThrow(COL_PAYMENT_METHOD));
                double expectedAmount = c.getDouble(c.getColumnIndexOrThrow(COL_EXPECTED_AMOUNT));
                String transactionId = c.getString(c.getColumnIndexOrThrow(COL_TRANSACTION_ID));
                String status = c.getString(c.getColumnIndexOrThrow(COL_STATUS));
                String senderNumber = c.getString(c.getColumnIndexOrThrow(COL_SENDER_NUMBER));
                double receivedAmount = c.getDouble(c.getColumnIndexOrThrow(COL_RECEIVED_AMOUNT));
                long createdAt = c.getLong(c.getColumnIndexOrThrow(COL_CREATED_AT));
                String syncStatus = c.getString(c.getColumnIndexOrThrow(COL_SYNC_STATUS));

                list.add(new PendingPaymentRecord(
                        paymentId, invoiceId, userId, userType, paymentMethod,
                        expectedAmount, transactionId, status, senderNumber,
                        receivedAmount, createdAt, syncStatus
                ));
            }
            c.close();
        }
        return list;
    }

    public synchronized void markUploaded(String trxId) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put(COL_SYNC_STATUS, "uploaded");
        db.update(TABLE_PAYMENTS, cv, COL_TRANSACTION_ID + " = ?", new String[]{trxId});
    }

    public synchronized void markSynced(String trxId) {
        markUploaded(trxId);
    }

    public synchronized void markVerified(String trxId) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put(COL_STATUS, "verified");
        cv.put(COL_SYNC_STATUS, "synced");
        db.update(TABLE_PAYMENTS, cv, COL_TRANSACTION_ID + " = ?", new String[]{trxId});
    }
}
