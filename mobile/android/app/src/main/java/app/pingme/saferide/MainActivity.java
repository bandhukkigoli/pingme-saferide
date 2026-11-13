package app.pingme.saferide;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

// The whole app is one screen: a web view showing the live SafeRide site.
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Always load the newest version of the site (never an old cached page).
    getBridge().getWebView().clearCache(true);
    getBridge().getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    // Let the alarm sound play without an extra tap inside the app.
    getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
  }
}
