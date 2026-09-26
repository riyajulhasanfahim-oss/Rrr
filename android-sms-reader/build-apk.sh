#!/usr/bin/env bash
set -e

echo "=== RJ World BD SMS Reader — APK Build Pipeline ==="

ANDROID_JAR="/opt/android-sdk/platforms/android-33/android.jar"
BUILD_TOOLS="/opt/android-sdk/build-tools/33.0.2"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/app" && pwd)"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

OUT_DIR="$APP_DIR/build/outputs/apk/debug"
WORK_DIR="/tmp/apk-build"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/gen" "$WORK_DIR/classes" "$WORK_DIR/bin" "$OUT_DIR"

echo "1. Generating R.java with aapt..."
aapt package -f -m \
  -J "$WORK_DIR/gen" \
  -M "$APP_DIR/src/main/AndroidManifest.xml" \
  -S "$APP_DIR/src/main/res" \
  -I "$ANDROID_JAR"

echo "2. Compiling Java sources with javac..."
javac -cp "$ANDROID_JAR" \
  -d "$WORK_DIR/classes" \
  $(find "$WORK_DIR/gen" -name "*.java") \
  $(find "$APP_DIR/src/main/java" -name "*.java")

echo "3. Converting bytecode with d8..."
"$BUILD_TOOLS/d8" --min-api 24 \
  --lib "$ANDROID_JAR" \
  --output "$WORK_DIR/bin" \
  $(find "$WORK_DIR/classes" -name "*.class")

echo "4. Packaging unaligned APK..."
aapt package -f \
  -M "$APP_DIR/src/main/AndroidManifest.xml" \
  -S "$APP_DIR/src/main/res" \
  -I "$ANDROID_JAR" \
  -F "$WORK_DIR/bin/unaligned.apk"

echo "5. Adding classes.dex..."
cd "$WORK_DIR/bin"
aapt add unaligned.apk classes.dex

echo "6. Aligning with zipalign..."
zipalign -v -p 4 unaligned.apk aligned.apk > /dev/null

echo "7. Generating debug keystore & signing with apksigner..."
if [ ! -f /tmp/debug.keystore ]; then
  keytool -genkey -v -keystore /tmp/debug.keystore \
    -storepass android -alias androiddebugkey -keypass android \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US"
fi

apksigner sign --ks /tmp/debug.keystore \
  --ks-pass pass:android --key-pass pass:android \
  "$WORK_DIR/bin/aligned.apk"

apksigner verify -v "$WORK_DIR/bin/aligned.apk"

echo "8. Deploying APK to release paths..."
cp "$WORK_DIR/bin/aligned.apk" "$OUT_DIR/app-debug.apk"
mkdir -p "$ROOT_DIR/public/downloads" "$ROOT_DIR/dist/downloads"
cp "$WORK_DIR/bin/aligned.apk" "$ROOT_DIR/public/downloads/rjworldbd-sms-reader.apk"
cp "$WORK_DIR/bin/aligned.apk" "$ROOT_DIR/dist/downloads/rjworldbd-sms-reader.apk"

echo "=== BUILD SUCCESSFUL ==="
ls -lh "$OUT_DIR/app-debug.apk" "$ROOT_DIR/public/downloads/rjworldbd-sms-reader.apk"
