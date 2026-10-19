# Coro mobile app (spec 008)

A Capacitor shell around the deployed web app. The whole call (camera, mic, tiles, recording) stays web; the only
native part is **screen sharing**, which phone browsers can't do. Native code runs a *share-only peer*: a second
session of the same user that joins the room and sends the phone screen. See `specs/008-native-mobile-share/`.

`CORO_URL` (env, read by `capacitor.config.ts`) is the origin the app loads, e.g. `https://meet.example.com`.
Run `bunx cap sync` after changing it.

## Android

Native code: `android/app/src/main/java/app/coro/meet/share/` (`NativeSharePlugin` → `ShareService` → `SharePeer`).

```bash
bun install
CORO_URL=https://meet.example.com bunx cap sync android
bun run android:build            # needs Android SDK 36 + JDK 21; APK in android/app/build/outputs/apk/debug/
```

No SDK locally? `dev/android-emulator.sh -S` builds and runs it in docker-android (KVM) against `bun run dev`,
and `NATIVE_ANDROID=1 bun run test:e2e tests/e2e/native-android.spec.ts` checks the whole share end to end.

## iOS (needs a Mac with Xcode 16+; not built in CI)

The screen is captured by a **Broadcast Upload Extension** (iOS only lets extensions keep capturing in the
background). Sources are in `ios-share/`; Capacitor generates the app project, the extension is added once in Xcode:

1. `CORO_URL=https://meet.example.com bunx cap add ios` (first time) or `bunx cap sync ios`, then `bun run ios:open`.
2. **App target** › Signing & Capabilities: add **App Groups** → `group.app.coro.meet`.
   Info: add `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` ("Coro uses the camera/microphone for video calls.").
3. File › New › Target › **Broadcast Upload Extension**, name `BroadcastExtension`, bundle id
   `app.coro.meet.BroadcastExtension`, *no* setup UI. Add the same App Group to it. Deployment target iOS 15.
4. Replace the generated `SampleHandler.swift` with `ios-share/BroadcastExtension/SampleHandler.swift`; add
   `ios-share/BroadcastExtension/SharePeer.swift` to the extension target.
5. Add `ios-share/Shared/ShareHandoff.swift` to **both** targets, and `ios-share/App/NativeSharePlugin.swift` to the app.
6. Swift packages (extension target): `https://github.com/stasel/WebRTC.git` (up to next major from 155.0.0) and
   `https://github.com/socketio/socket.io-client-swift` (16.1.1+).
7. Register the plugin: create `App/MainViewController.swift`
   ```swift
   import Capacitor
   class MainViewController: CAPBridgeViewController {
       override open func capacitorDidLoad() { bridge?.registerPluginInstance(NativeSharePlugin()) }
   }
   ```
   and set it as the custom class of the view controller in `Main.storyboard`.
8. Run on a **real iPhone** (the simulator can't broadcast): join a call → More → Share screen → Start Broadcast.

Stop paths: in-app Stop presenting, the red status-bar pill, the host, someone else presenting, leaving the call.
