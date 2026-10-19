package app.coro.meet.share;

import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjection;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import io.socket.client.Ack;
import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.engineio.client.transports.WebSocket;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONObject;
import org.webrtc.DataChannel;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpTransceiver;
import org.webrtc.ScreenCapturerAndroid;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

/**
 * Spec 008 native share-only peer: joins the call as a second session of the same user (`here: "also"`), sends
 * only the phone screen, in a stream whose id is the web call's `screenId` so viewers show it as our presentation
 * (spec 007 FR3). Speaks the web protocol (src/lib/socket.io/events.ts) and mirrors src/lib/webrtc/peer.ts:
 * perfect negotiation, the polite side never makes the first offer, inbound signals applied one at a time.
 */
final class SharePeer {

    private static final String TAG = "CoroShare";
    private static final int MAX_EDGE = 1280; // 720p-class: the mesh encodes the screen once per viewer
    private static final int FPS = 15;

    private final Context ctx;
    private final int resultCode;
    private final Intent consent;
    private final String origin, code, screenId, joinToken, cookie;
    private final Consumer<String> onEnd;
    private final AtomicBoolean ended = new AtomicBoolean(false);
    /** Every PeerConnection operation runs here, one at a time (the web's per-peer `chain`). */
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Map<String, Remote> peers = new HashMap<>();
    private final Handler main = new Handler(Looper.getMainLooper());

    private EglBase egl;
    private PeerConnectionFactory factory;
    private ScreenCapturerAndroid capturer;
    private SurfaceTextureHelper textures;
    private VideoSource source;
    private VideoTrack track;
    private List<PeerConnection.IceServer> ice = new ArrayList<>();
    private Socket socket;

    private static final class Remote {
        final String id;
        final boolean polite;
        PeerConnection pc;
        boolean makingOffer, ignoreOffer;

        Remote(String id, boolean polite) {
            this.id = id;
            this.polite = polite;
        }
    }

    SharePeer(Context ctx, int resultCode, Intent consent, String origin, String code, String screenId,
              String joinToken, String cookie, Consumer<String> onEnd) {
        this.ctx = ctx;
        this.resultCode = resultCode;
        this.consent = consent;
        this.origin = origin;
        this.code = code;
        this.screenId = screenId;
        this.joinToken = joinToken;
        this.cookie = cookie;
        this.onEnd = onEnd;
    }

    void start() {
        exec.execute(() -> {
            try {
                ice = fetchIce();
                startCapture();
                connect();
            } catch (Exception e) {
                Log.e(TAG, "start failed", e);
                end("error");
            }
        });
    }

    /** Local stop (user / service): no callback. */
    void stop() {
        if (!ended.compareAndSet(false, true)) return;
        exec.execute(this::release);
        exec.shutdown();
    }

    /** Remote or system end: release and tell the service once. */
    private void end(String reason) {
        if (!ended.compareAndSet(false, true)) return;
        exec.execute(this::release);
        exec.shutdown();
        main.post(() -> onEnd.accept(reason));
    }

    // ---- capture ----

    private void startCapture() {
        egl = EglBase.create();
        PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(ctx).createInitializationOptions());
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(new DefaultVideoEncoderFactory(egl.getEglBaseContext(), true, true))
            .setVideoDecoderFactory(new DefaultVideoDecoderFactory(egl.getEglBaseContext()))
            .createPeerConnectionFactory();
        capturer = new ScreenCapturerAndroid(consent, new MediaProjection.Callback() {
            @Override
            public void onStop() {
                end("system"); // status-bar / settings "stop sharing"
            }
        });
        textures = SurfaceTextureHelper.create("CoroScreen", egl.getEglBaseContext());
        source = factory.createVideoSource(true); // screencast: keep resolution, drop frames under load
        capturer.initialize(textures, ctx, source.getCapturerObserver());
        DisplayMetrics m = ctx.getResources().getDisplayMetrics();
        double scale = Math.min(1.0, (double) MAX_EDGE / Math.max(m.widthPixels, m.heightPixels));
        capturer.startCapture((int) (m.widthPixels * scale) & ~1, (int) (m.heightPixels * scale) & ~1, FPS);
        track = factory.createVideoTrack("screen", source);
    }

    // ---- signaling ----

    private void connect() throws Exception {
        Map<String, List<String>> headers = new HashMap<>();
        if (cookie != null) headers.put("Cookie", Collections.singletonList(cookie));
        IO.Options opts = IO.Options.builder()
            .setTransports(new String[] {WebSocket.NAME})
            .setExtraHeaders(headers)
            .setReconnection(false)
            .build();
        socket = IO.socket(URI.create(origin), opts);
        socket.on(Socket.EVENT_CONNECT, a -> exec.execute(this::join));
        socket.on(Socket.EVENT_CONNECT_ERROR, a -> end("connect_error"));
        socket.on(Socket.EVENT_DISCONNECT, a -> end("disconnected"));
        socket.on("peer:joined", a -> exec.execute(() -> addPeer(((JSONObject) a[0]).optString("id"), false)));
        socket.on("peer:left", a -> exec.execute(() -> dropPeer((String) a[0])));
        socket.on("signal", a -> exec.execute(() -> onSignal((String) a[0], (JSONObject) a[1])));
        socket.on("share:stop", a -> end((String) a[0])); // "takeover" | "host"
        socket.on("kicked", a -> end("kicked"));
        socket.on("room:ended", a -> end("ended"));
        socket.on("moved", a -> end("moved"));
        socket.connect();
    }

    private JSONObject state() throws Exception {
        return new JSONObject().put("mic", false).put("cam", false).put("screen", true).put("screenId", screenId);
    }

    private void join() {
        try {
            // State first, so everyone's peer:joined already marks us share-only (spec 008 FR8, no server change).
            socket.emit("state", state());
            JSONObject opts = new JSONObject().put("here", "also");
            if (joinToken != null) opts.put("joinToken", joinToken);
            socket.emit("room:join", new Object[] {code, opts}, (Ack) args -> exec.execute(() -> onJoined((JSONObject) args[0])));
        } catch (Exception e) {
            end("error");
        }
    }

    private void onJoined(JSONObject r) {
        try {
            if (!r.optBoolean("ok")) {
                end("join_" + r.optString("error"));
                return;
            }
            if (!"admitted".equals(r.optString("status"))) {
                end("waiting"); // shouldn't happen: same signed-in user
                return;
            }
            JSONArray list = r.optJSONArray("peers");
            for (int i = 0; list != null && i < list.length(); i++) addPeer(list.getJSONObject(i).optString("id"), true);
            socket.emit("state", state()); // in the room now: takes the presenter slot (spec 007 FR6)
        } catch (Exception e) {
            end("error");
        }
    }

    // ---- peers ----

    private void addPeer(String id, boolean polite) {
        if (id.isEmpty() || peers.containsKey(id) || ended.get()) return;
        Remote r = new Remote(id, polite);
        PeerConnection.RTCConfiguration cfg = new PeerConnection.RTCConfiguration(ice);
        cfg.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        r.pc = factory.createPeerConnection(cfg, new Observer(r));
        if (r.pc == null) return;
        // Send only: the phone shouldn't also download everyone's video (spec 008 D7).
        r.pc.addTransceiver(track, new RtpTransceiver.RtpTransceiverInit(
            RtpTransceiver.RtpTransceiverDirection.SEND_ONLY, Collections.singletonList(screenId)));
        peers.put(id, r);
    }

    private void dropPeer(String id) {
        Remote r = peers.remove(id);
        if (r != null && r.pc != null) r.pc.close();
    }

    private void negotiate(Remote r) {
        // Same rule as peer.ts: the first offer comes from the impolite side only.
        if (r.polite && r.pc.getRemoteDescription() == null) return;
        try {
            r.makingOffer = true;
            setLocal(r.pc);
            send(r.id, describe(r.pc.getLocalDescription()));
        } catch (Exception e) {
            Log.w(TAG, "offer failed " + r.id, e);
        } finally {
            r.makingOffer = false;
        }
    }

    private void onSignal(String from, JSONObject data) {
        Remote r = peers.get(from);
        if (r == null) return;
        try {
            JSONObject d = data.optJSONObject("description");
            if (d != null) {
                SessionDescription desc = new SessionDescription(
                    SessionDescription.Type.fromCanonicalForm(d.getString("type")), d.getString("sdp"));
                boolean offer = desc.type == SessionDescription.Type.OFFER;
                boolean collision = offer && (r.makingOffer || r.pc.signalingState() != PeerConnection.SignalingState.STABLE);
                r.ignoreOffer = !r.polite && collision;
                if (r.ignoreOffer) return;
                if (collision) sdp(o -> r.pc.setLocalDescription(o, new SessionDescription(SessionDescription.Type.ROLLBACK, "")));
                sdp(o -> r.pc.setRemoteDescription(o, desc));
                if (offer) {
                    setLocal(r.pc);
                    send(r.id, describe(r.pc.getLocalDescription()));
                }
            } else if (data.has("candidate") && !data.isNull("candidate")) {
                JSONObject c = data.getJSONObject("candidate");
                r.pc.addIceCandidate(new IceCandidate(c.optString("sdpMid"), c.optInt("sdpMLineIndex"), c.getString("candidate")));
            }
        } catch (Exception e) {
            Log.w(TAG, "signal failed " + from, e); // negotiation recovers on the next offer cycle
        }
    }

    private void send(String to, JSONObject data) {
        if (socket != null && !ended.get()) socket.emit("signal", to, data);
    }

    private static JSONObject describe(SessionDescription d) throws Exception {
        return new JSONObject().put("description",
            new JSONObject().put("type", d.type.canonicalForm()).put("sdp", d.description));
    }

    private void setLocal(PeerConnection pc) throws Exception {
        sdp(pc::setLocalDescription); // implicit offer/answer, like pc.setLocalDescription() on the web
    }

    /** Run one async SDP operation and wait for it (we're on `exec`; callbacks arrive on WebRTC's thread). */
    private static void sdp(Consumer<SdpObserver> op) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        String[] error = {null};
        op.accept(new SdpObserver() {
            @Override public void onCreateSuccess(SessionDescription d) {}
            @Override public void onSetSuccess() { done.countDown(); }
            @Override public void onCreateFailure(String e) { error[0] = e; done.countDown(); }
            @Override public void onSetFailure(String e) { error[0] = e; done.countDown(); }
        });
        if (!done.await(10, TimeUnit.SECONDS)) throw new Exception("sdp timeout");
        if (error[0] != null) throw new Exception(error[0]);
    }

    private final class Observer implements PeerConnection.Observer {
        private final Remote r;

        Observer(Remote r) {
            this.r = r;
        }

        @Override public void onRenegotiationNeeded() { exec.execute(() -> { if (peers.get(r.id) == r) negotiate(r); }); }

        @Override public void onIceCandidate(IceCandidate c) {
            try {
                send(r.id, new JSONObject().put("candidate", new JSONObject()
                    .put("candidate", c.sdp).put("sdpMid", c.sdpMid).put("sdpMLineIndex", c.sdpMLineIndex)));
            } catch (Exception ignored) {
                // JSON of plain strings/ints can't fail
            }
        }

        @Override public void onSignalingChange(PeerConnection.SignalingState s) {}
        @Override public void onIceConnectionChange(PeerConnection.IceConnectionState s) {}
        @Override public void onIceConnectionReceivingChange(boolean b) {}
        @Override public void onIceGatheringChange(PeerConnection.IceGatheringState s) {}
        @Override public void onIceCandidatesRemoved(IceCandidate[] c) {}
        @Override public void onAddStream(MediaStream s) {}
        @Override public void onRemoveStream(MediaStream s) {}
        @Override public void onDataChannel(DataChannel d) {}
    }

    // ---- ICE + teardown ----

    private List<PeerConnection.IceServer> fetchIce() throws Exception {
        HttpURLConnection http = (HttpURLConnection) new URL(origin + "/api/ice-servers").openConnection();
        if (cookie != null) http.setRequestProperty("Cookie", cookie);
        StringBuilder body = new StringBuilder();
        try (BufferedReader in = new BufferedReader(new InputStreamReader(http.getInputStream()))) {
            for (String line; (line = in.readLine()) != null; ) body.append(line);
        }
        JSONArray arr = new JSONArray(body.toString());
        List<PeerConnection.IceServer> out = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject s = arr.getJSONObject(i);
            List<String> urls = new ArrayList<>();
            JSONArray many = s.optJSONArray("urls");
            if (many != null) for (int j = 0; j < many.length(); j++) urls.add(many.getString(j));
            else urls.add(s.getString("urls"));
            out.add(PeerConnection.IceServer.builder(urls)
                .setUsername(s.optString("username", ""))
                .setPassword(s.optString("credential", ""))
                .createIceServer());
        }
        return out;
    }

    private void release() {
        if (socket != null) {
            socket.off();
            socket.disconnect();
        }
        for (Remote r : peers.values()) if (r.pc != null) r.pc.dispose();
        peers.clear();
        if (capturer != null) {
            capturer.stopCapture();
            capturer.dispose();
        }
        if (track != null) track.dispose();
        if (source != null) source.dispose();
        if (textures != null) textures.dispose();
        if (factory != null) factory.dispose();
        if (egl != null) egl.release();
    }
}
