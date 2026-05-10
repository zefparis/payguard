package com.iasolution.payguard;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "PayGuard";
    private ActivityResultLauncher<String[]> mediaPermLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Log.d(TAG, "onCreate START");

        mediaPermLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            results -> {
                for (java.util.Map.Entry<String, Boolean> e : results.entrySet()) {
                    Log.d(TAG, "Permission " + e.getKey() + " = " + e.getValue());
                }
            }
        );

        super.onCreate(savedInstanceState);

        // Clear cached WebView permission denials (not storage data)
        GeolocationPermissions.getInstance().clearAll();

        // Ensure media playback doesn't require user gesture
        WebSettings ws = getBridge().getWebView().getSettings();
        ws.setMediaPlaybackRequiresUserGesture(false);
        Log.d(TAG, "WebSettings mediaPlaybackRequiresUserGesture=false");

        // Override WebChromeClient to auto-grant WebView permission requests
        getBridge().getWebView().setWebChromeClient(
            new BridgeWebChromeClient(getBridge()) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    String[] resources = request.getResources();
                    StringBuilder sb = new StringBuilder();
                    for (String r : resources) sb.append(r).append(", ");
                    Log.d(TAG, "onPermissionRequest: " + sb.toString());
                    runOnUiThread(() -> {
                        request.grant(resources);
                        Log.d(TAG, "onPermissionRequest: GRANTED");
                    });
                }
            }
        );

        // Request CAMERA + RECORD_AUDIO at runtime if not already granted
        java.util.List<String> needed = new java.util.ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }
        Log.d(TAG, "Permissions needed: " + needed);
        if (!needed.isEmpty()) {
            mediaPermLauncher.launch(needed.toArray(new String[0]));
        }

        Log.d(TAG, "onCreate END");
    }
}
