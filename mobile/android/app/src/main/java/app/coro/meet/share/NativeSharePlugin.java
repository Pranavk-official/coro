package app.coro.meet.share;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.webkit.CookieManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Spec 008: phone screen share. The web call (WebView) asks for it; this plugin gets the system consent and
 * starts {@link ShareService}, which runs a native share-only peer in the same room. Web API: src/lib/native/share.ts.
 */
@CapacitorPlugin(name = "NativeShare")
public class NativeSharePlugin extends Plugin {

    private static NativeSharePlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** Called by the service when sharing ends for any reason (system stop, takeover, host, kicked, ended). */
    static void stopped(String reason) {
        NativeSharePlugin p = instance;
        if (p == null) return;
        JSObject e = new JSObject();
        e.put("reason", reason);
        p.notifyListeners("stopped", e);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (call.getString("origin") == null || call.getString("code") == null || call.getString("screenId") == null) {
            call.reject("origin, code and screenId are required");
            return;
        }
        MediaProjectionManager mpm = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(call, mpm.createScreenCaptureIntent(), "onConsent");
    }

    @ActivityCallback
    private void onConsent(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("cancelled", "NotAllowedError");
            return;
        }
        String origin = call.getString("origin");
        Intent svc = new Intent(getContext(), ShareService.class)
            .putExtra(ShareService.EXTRA_RESULT_CODE, result.getResultCode())
            .putExtra(ShareService.EXTRA_DATA, result.getData())
            .putExtra(ShareService.EXTRA_ORIGIN, origin)
            .putExtra(ShareService.EXTRA_CODE, call.getString("code"))
            .putExtra(ShareService.EXTRA_SCREEN_ID, call.getString("screenId"))
            .putExtra(ShareService.EXTRA_JOIN_TOKEN, call.getString("joinToken"))
            // Same better-auth session as the WebView (spec 008 D6); stays on this device and this origin.
            .putExtra(ShareService.EXTRA_COOKIE, CookieManager.getInstance().getCookie(origin));
        getContext().startForegroundService(svc);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().startService(new Intent(getContext(), ShareService.class).setAction(ShareService.ACTION_STOP));
        call.resolve();
    }
}
