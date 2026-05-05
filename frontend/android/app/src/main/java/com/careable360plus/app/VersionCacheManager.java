package com.careable360plus.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import android.webkit.WebView;
import java.io.File;

public class VersionCacheManager {
    private static final String TAG = "VersionCacheManager";
    private static final String PREFS_NAME = "AppVersionPrefs";
    private static final String KEY_VERSION = "app_version";
    private static final String CURRENT_VERSION = "2.0.1"; // Update this with each build
    
    public static void checkAndClearCache(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String storedVersion = prefs.getString(KEY_VERSION, null);
        
        Log.d(TAG, "Stored version: " + storedVersion);
        Log.d(TAG, "Current version: " + CURRENT_VERSION);
        
        // If version changed or first run
        if (storedVersion == null || !storedVersion.equals(CURRENT_VERSION)) {
            Log.i(TAG, "Version changed! Clearing WebView cache...");
            
            try {
                // Clear WebView cache
                WebView webView = new WebView(context);
                webView.clearCache(true);
                webView.clearHistory();
                webView.clearFormData();
                webView.destroy();
                Log.i(TAG, "WebView cache cleared");
                
                // Clear app cache directory
                clearCacheDirectory(context.getCacheDir());
                Log.i(TAG, "App cache directory cleared");
                
                // Clear WebView cache directory
                File webViewCacheDir = new File(context.getCacheDir(), "webview");
                if (webViewCacheDir.exists()) {
                    clearCacheDirectory(webViewCacheDir);
                    Log.i(TAG, "WebView cache directory cleared");
                }
                
                // Save new version
                prefs.edit().putString(KEY_VERSION, CURRENT_VERSION).apply();
                Log.i(TAG, "Version updated to: " + CURRENT_VERSION);
                
            } catch (Exception e) {
                Log.e(TAG, "Error clearing cache: " + e.getMessage(), e);
            }
        } else {
            Log.d(TAG, "Version unchanged, no cache clearing needed");
        }
    }
    
    private static void clearCacheDirectory(File dir) {
        if (dir != null && dir.isDirectory()) {
            try {
                for (File child : dir.listFiles()) {
                    if (child.isDirectory()) {
                        clearCacheDirectory(child);
                    }
                    child.delete();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error clearing directory: " + e.getMessage(), e);
            }
        }
    }
    
    public static String getCurrentVersion() {
        return CURRENT_VERSION;
    }
}
