package com.rjworldbd.smsreader;

import android.app.Application;
import com.rjworldbd.smsreader.data.PaymentDbHelper;
import com.rjworldbd.smsreader.service.SmsReaderForegroundService;

public class RjWorldBdApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        PaymentDbHelper.getInstance(this);
        try {
            SmsReaderForegroundService.start(this);
            com.rjworldbd.smsreader.sync.SyncManager.triggerSync(this);
        } catch (Exception ignored) {}
    }
}
