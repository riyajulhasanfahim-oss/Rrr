package com.rjworldbd.smsreader.ui;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import com.rjworldbd.smsreader.R;
import com.rjworldbd.smsreader.data.PaymentDbHelper;
import com.rjworldbd.smsreader.service.SmsReaderForegroundService;
import com.rjworldbd.smsreader.sync.SyncManager;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final int PERMISSION_REQUEST_CODE = 1001;
    private TextView tvStatus;
    private TextView tvDiagnosticLogs;
    private Button btnManualSync;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        tvStatus = findViewById(R.id.tv_service_status);
        tvDiagnosticLogs = findViewById(R.id.tv_diagnostic_logs);
        btnManualSync = findViewById(R.id.btn_manual_sync);

        if (btnManualSync != null) {
            btnManualSync.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    Toast.makeText(MainActivity.this, "Triggering sync to server...", Toast.LENGTH_SHORT).show();
                    SyncManager.triggerSync(MainActivity.this);
                }
            });
        }

        SyncManager.setLogListener(new SyncManager.SyncLogListener() {
            @Override
            public void onLogUpdated(final String fullLogText) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (tvDiagnosticLogs != null) {
                            tvDiagnosticLogs.setText(fullLogText);
                        }
                        updateStatusDisplay();
                    }
                });
            }
        });

        checkAndRequestPermissions();
        updateStatusDisplay();

        // Trigger an immediate sync attempt on app launch
        SyncManager.triggerSync(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateStatusDisplay();
        if (tvDiagnosticLogs != null) {
            tvDiagnosticLogs.setText(SyncManager.getDiagnosticLogsText());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        SyncManager.setLogListener(null);
    }

    private void updateStatusDisplay() {
        if (tvStatus == null) return;
        PaymentDbHelper db = PaymentDbHelper.getInstance(this);
        int total = db.getTotalCount();
        int pending = db.getPendingCount();
        int synced = db.getSyncedCount();
        tvStatus.setText("Monitoring Active\nTotal: " + total + " | Pending: " + pending + " | Synced: " + synced);
    }

    private void checkAndRequestPermissions() {
        List<String> permissions = new ArrayList<>();
        if (checkCallingOrSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECEIVE_SMS);
        }
        if (checkCallingOrSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_SMS);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkCallingOrSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!permissions.isEmpty()) {
            requestPermissions(permissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        } else {
            SmsReaderForegroundService.start(this);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean smsGranted = false;
            for (int i = 0; i < permissions.length; i++) {
                if (Manifest.permission.RECEIVE_SMS.equals(permissions[i]) && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                    smsGranted = true;
                    break;
                }
            }
            if (smsGranted) {
                SmsReaderForegroundService.start(this);
                Toast.makeText(this, "SMS Permission Granted. RJ World BD Payment Service is Active.", Toast.LENGTH_LONG).show();
                SyncManager.triggerSync(this);
            } else {
                SmsReaderForegroundService.stop(this, "SMS Permission unavailable");
                Toast.makeText(this, "SMS Permission Denied. Service cannot read payment SMS.", Toast.LENGTH_LONG).show();
            }
            updateStatusDisplay();
        }
    }
}
