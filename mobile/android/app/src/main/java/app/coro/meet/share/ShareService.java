package app.coro.meet.share;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Foreground service (type mediaProjection, required to capture the screen from API 29 and to keep sharing while
 * the app is in the background). Owns one {@link SharePeer}; its notification has a Stop action.
 */
public class ShareService extends Service {

    static final String ACTION_STOP = "app.coro.meet.share.STOP";
    static final String EXTRA_RESULT_CODE = "resultCode";
    static final String EXTRA_DATA = "data";
    static final String EXTRA_ORIGIN = "origin";
    static final String EXTRA_CODE = "code";
    static final String EXTRA_SCREEN_ID = "screenId";
    static final String EXTRA_JOIN_TOKEN = "joinToken";
    static final String EXTRA_COOKIE = "cookie";

    private static final String CHANNEL = "share";
    private static final int NOTIFICATION_ID = 8;

    private SharePeer peer;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            finish("user");
            return START_NOT_STICKY;
        }
        // Must be in the foreground with the mediaProjection type *before* the projection is created (API 34+).
        startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        if (peer != null) peer.stop(); // a new share replaces the old one
        peer = new SharePeer(
            getApplicationContext(),
            intent.getIntExtra(EXTRA_RESULT_CODE, 0),
            consent(intent),
            intent.getStringExtra(EXTRA_ORIGIN),
            intent.getStringExtra(EXTRA_CODE),
            intent.getStringExtra(EXTRA_SCREEN_ID),
            intent.getStringExtra(EXTRA_JOIN_TOKEN),
            intent.getStringExtra(EXTRA_COOKIE),
            this::finish
        );
        peer.start();
        return START_NOT_STICKY;
    }

    @SuppressWarnings("deprecation") // typed getParcelableExtra is API 33+; minSdk is 29
    private static Intent consent(Intent intent) {
        return intent.getParcelableExtra(EXTRA_DATA);
    }

    /** Every stop path ends here once (FR5): tell the web call, drop the notification, end the service. */
    private void finish(String reason) {
        SharePeer p = peer;
        peer = null;
        if (p != null) p.stop();
        NativeSharePlugin.stopped(reason);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private Notification notification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Screen sharing", NotificationManager.IMPORTANCE_LOW));
        PendingIntent stop = PendingIntent.getService(
            this, 0, new Intent(this, ShareService.class).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setContentTitle("Presenting in Coro")
            .setContentText("Everyone in the call can see your screen.")
            .setOngoing(true)
            .addAction(0, "Stop", stop)
            .build();
    }

    @Override
    public void onDestroy() {
        if (peer != null) finish("destroyed");
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
