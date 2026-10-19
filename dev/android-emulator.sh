#!/usr/bin/env bash
# Android emulator for spec 008 (native screen share), via docker-android: build the app, run it, test it.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${ANDROID_CONTAINER:-coro-android}"
IMAGE="budtmo/docker-android:emulator_14.0"
APK=/home/androidusr/coro/android/app/build/outputs/apk/debug/app-debug.apk
JDK_URL="https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"

usage() {
  cat <<'EOF2'
Usage: android-emulator.sh -S | -B | -Q | -R | -h
  -S   start: container (KVM), SDK 36 + JDK 21, build + install the app, relay dev server + adb (needs `bun run dev` on :3000)
  -B   rebuild the debug APK and reinstall it
  -Q   status (device, app, relays); emulator screen at http://localhost:6080
  -R   remove the container (prompt)
  -h   this help
Then: NATIVE_ANDROID=1 bun run test:e2e tests/e2e/native-android.spec.ts
EOF2
}

ctr() { docker exec "$NAME" bash -lc "$1"; }
root() { docker exec -u 0 "$NAME" bash -lc "$1"; }

build() {
  docker exec -u "$(id -u):$(id -g)" -e HOME=/tmp/h -e JAVA_HOME=/opt/jdk21 -e ANDROID_HOME=/opt/android \
    -e GRADLE_USER_HOME=/tmp/gradle -w /home/androidusr/coro/android "$NAME" \
    bash -lc 'mkdir -p /tmp/h && ./gradlew assembleDebug --no-daemon -q'
  ctr "adb uninstall app.coro.meet >/dev/null 2>&1 || true; adb install $APK"
  for p in CAMERA RECORD_AUDIO POST_NOTIFICATIONS; do ctr "adb shell pm grant app.coro.meet android.permission.$p"; done
}

relays() {
  local ip
  ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$NAME")
  docker cp dev/tcp-relay.py "$NAME":/tmp/tcp-relay.py
  # emulator localhost:3000 -> container -> host dev server (same origin as BETTER_AUTH_URL)
  docker exec -d "$NAME" python3 /tmp/tcp-relay.py 127.0.0.1 3000 host.docker.internal 3000
  ctr "adb reverse tcp:3000 tcp:3000"
  # host localhost:5037 -> container adb server, for Playwright's _android
  docker exec -d "$NAME" python3 /tmp/tcp-relay.py 0.0.0.0 5038 127.0.0.1 5037
  if ! pgrep -f "tcp-relay.py 127.0.0.1 5037" >/dev/null; then
    setsid nohup python3 dev/tcp-relay.py 127.0.0.1 5037 "$ip" 5038 </dev/null >/dev/null 2>&1 &
    disown
  fi
}

case "${1:-}" in
  -h) usage ;;
  -S)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" --add-host=host.docker.internal:host-gateway -p 127.0.0.1:6080:6080 \
      --device /dev/kvm -e EMULATOR_DEVICE="Samsung Galaxy S10" -e WEB_VNC=true \
      -v "$PWD/mobile:/home/androidusr/coro" "$IMAGE" >/dev/null
    echo "booting emulator…"
    until [ "$(ctr 'cat device_status 2>/dev/null' || true)" = "READY" ]; do sleep 5; done
    # Capacitor 8 compiles against SDK 36; Gradle 8.14 can't run on the image's Java 25.
    root 'yes | sdkmanager "platforms;android-36" "build-tools;35.0.0" >/dev/null; chmod o+x /home/androidusr'
    tmp=$(mktemp); curl -sL -o "$tmp" "$JDK_URL"; docker cp "$tmp" "$NAME":/opt/jdk21.tgz; rm -f "$tmp"
    root 'mkdir -p /opt/jdk21 && tar xzf /opt/jdk21.tgz -C /opt/jdk21 --strip-components=1 && rm /opt/jdk21.tgz'
    (cd mobile && bun install >/dev/null && bunx cap sync android >/dev/null)
    build
    relays
    echo "ready: http://localhost:6080 (screen)"
    ;;
  -B) (cd mobile && bunx cap sync android >/dev/null) && build ;;
  -Q)
    ctr 'echo "device: $(cat device_status)"; adb shell pidof app.coro.meet >/dev/null && echo "app: running" || echo "app: not running"'
    pgrep -f "tcp-relay.py 127.0.0.1 5037" >/dev/null && echo "adb relay: up" || echo "adb relay: down"
    ;;
  -R)
    read -r -p "Remove the $NAME container (emulator state is lost)? [y/N] " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "aborted"; exit 0; }
    docker rm -f "$NAME" >/dev/null
    pkill -f "tcp-relay.py 127.0.0.1 5037" || true
    ;;
  *) usage; exit 1 ;;
esac
