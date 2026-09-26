package com.rjworldbd.smsreader.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import com.rjworldbd.smsreader.R;
import com.rjworldbd.smsreader.ui.MainActivity;

/**
 * Foreground Service that maintains persistent background execution for SMS Reader.
 * Displays ongoing notification with status:
 * Title: "RJ World BD Payment Service"
 * Body: "Pending: X | Synced: X"
 */
public class SmsReaderForegroundService extends Service {

    public static final String CHANNEL_ID = "rj_world_bd_payment_service_channel";
    public static final int NOTIFICATION_ID = 1001;
    public static final int INACTIVE_NOTIFICATION_ID = 1002;

    public static final String ACTION_START = "ACTION_START_SERVICE";
    public static final String ACTION_STOP = "ACTION_STOP_SERVICE";
    public static final String ACTION_UPDATE_COUNT = "ACTION_UPDATE_PENDING_COUNT";
    public static final String EXTRA_PENDING_COUNT = "EXTRA_PENDING_COUNT";
    public static final String EXTRA_SYNCED_COUNT = "EXTRA_SYNCED_COUNT";
    public static final String EXTRA_INACTIVE_REASON = "EXTRA_INACTIVE_REASON";

    private int pendingCount = 0;
    private int syncedCount = 0;
    private java.util.concurrent.ScheduledExecutorService periodicSyncScheduler;

    public static void start(Context context) {
        Intent intent = new Intent(context, SmsReaderForegroundService.class);
        intent.setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context, String reason) {
        Intent intent = new Intent(context, SmsReaderForegroundService.class);
        intent.setAction(ACTION_STOP);
        intent.putExtra(EXTRA_INACTIVE_REASON, reason != null ? reason : "Service paused");
        context.startService(intent);
    }

    public static void updateCounts(Context context, int pending, int synced) {
        Intent intent = new Intent(context, SmsReaderForegroundService.class);
        intent.setAction(ACTION_UPDATE_COUNT);
        intent.putExtra(EXTRA_PENDING_COUNT, pending);
        intent.putExtra(EXTRA_SYNCED_COUNT, synced);
        context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startPeriodicSync();
    }

    private void startPeriodicSync() {
        if (periodicSyncScheduler == null || periodicSyncScheduler.isShutdown()) {
            periodicSyncScheduler = java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
            periodicSyncScheduler.scheduleWithFixedDelay(new Runnable() {
                @Override
                public void run() {
                    try {
                        com.rjworldbd.smsreader.sync.SyncManager.triggerSync(getApplicationContext());
                    } catch (Exception ignored) {}
                }
            }, 5, 12, java.util.concurrent.TimeUnit.SECONDS);
        }
    }

    private void stopPeriodicSync() {
        if (periodicSyncScheduler != null && !periodicSyncScheduler.isShutdown()) {
            periodicSyncScheduler.shutdownNow();
            periodicSyncScheduler = null;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                stopPeriodicSync();
                String reason = intent.getStringExtra(EXTRA_INACTIVE_REASON);
                showInactiveNotification(reason != null ? reason : "Service stopped");
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            } else if (ACTION_UPDATE_COUNT.equals(action)) {
                pendingCount = intent.getIntExtra(EXTRA_PENDING_COUNT, pendingCount);
                syncedCount = intent.getIntExtra(EXTRA_SYNCED_COUNT, syncedCount);
                updateNotification();
            }
        }
        startPeriodicSync();
        startForeground(NOTIFICATION_ID, buildActiveNotification());
        return START_STICKY;
    }

    private Notification buildActiveNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        } else {
            pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT);
        }

        String contentText = "Pending: " + pendingCount + " | Synced: " + syncedCount;

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle("RJ World BD Payment Service")
               .setContentText(contentText)
               .setSmallIcon(R.mipmap.ic_launcher)
               .setContentIntent(pendingIntent)
               .setOngoing(true);

        return builder.build();
    }

    private void showInactiveNotification(String reason) {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        } else {
            pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT);
        }

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle("RJ World BD Payment Service — Inactive")
               .setContentText(reason)
               .setSmallIcon(R.mipmap.ic_launcher)
               .setContentIntent(pendingIntent)
               .setAutoCancel(true)
               .setOngoing(false);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(INACTIVE_NOTIFICATION_ID, builder.build());
        }
    }

    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildActiveNotification());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "RJ World BD Payment Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows persistent status of RJ World BD SMS Reader Service");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopPeriodicSync();
        super.onDestroy();
    }
}
