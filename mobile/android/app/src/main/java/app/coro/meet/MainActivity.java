package app.coro.meet;

import android.os.Bundle;
import app.coro.meet.share.NativeSharePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSharePlugin.class); // app-local plugin: must be registered before the bridge starts
        super.onCreate(savedInstanceState);
    }
}
