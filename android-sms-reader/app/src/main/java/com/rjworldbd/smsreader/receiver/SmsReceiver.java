package com.rjworldbd.smsreader.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import com.rjworldbd.smsreader.data.PaymentDbHelper;
import com.rjworldbd.smsreader.parser.PaymentSmsParser;
import com.rjworldbd.smsreader.parser.PaymentSmsParser.ParsedPayment;
import com.rjworldbd.smsreader.service.SmsReaderForegroundService;
import com.rjworldbd.smsreader.sync.SyncManager;

/**
 * BroadcastReceiver for incoming SMS.
 * STRICT ENFORCEMENT:
 * 1. Only processes bKash, Nagad, Rocket, Upay payment SMS.
 * 2. All other messages (personal, promo, OTP) are immediately ignored.
 * 3. Never stores raw SMS text anywhere.
 * 4. Checks duplicate TrxID before insertion.
 * 5. Updates persistent foreground notification counts.
 */
public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;

        String format = bundle.getString("format");
        StringBuilder bodyBuilder = new StringBuilder();
        String sender = null;
        long timestamp = System.currentTimeMillis();

        for (Object pdu : pdus) {
            SmsMessage message;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                message = SmsMessage.createFromPdu((byte[]) pdu, format);
            } else {
                message = SmsMessage.createFromPdu((byte[]) pdu);
            }
            if (message != null) {
                if (sender == null) {
                    sender = message.getOriginatingAddress();
                    timestamp = message.getTimestampMillis();
                }
                bodyBuilder.append(message.getMessageBody());
            }
        }

        if (sender == null || bodyBuilder.length() == 0) return;

        // Parse and detect MFS payment SMS
        ParsedPayment payment = PaymentSmsParser.parse(sender, bodyBuilder.toString(), timestamp);
        if (payment == null) {
            // Non-payment SMS or unsupported provider: discard immediately
            return;
        }

        // Check for duplicate TrxID and insert
        final Context appContext = context.getApplicationContext();
        PaymentDbHelper db = PaymentDbHelper.getInstance(appContext);
        db.insertParsedPayment(payment);

        // Update foreground service counts
        int pending = db.getPendingCount();
        int synced = db.getSyncedCount();
        SmsReaderForegroundService.updateCounts(appContext, pending, synced);

        // Immediately sync this detected payment to Firebase Realtime Database with zero delay
        SyncManager.syncPaymentImmediately(appContext, payment);
        // Also trigger queue sync for any pending offline records
        SyncManager.triggerSync(appContext);
    }
}
