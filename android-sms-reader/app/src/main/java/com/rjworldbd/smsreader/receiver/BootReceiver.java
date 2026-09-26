package com.rjworldbd.smsreader.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.rjworldbd.smsreader.service.SmsReaderForegroundService;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            SmsReaderForegroundService.start(context);
            com.rjworldbd.smsreader.sync.SyncManager.triggerSync(context);
        }
    }
}
