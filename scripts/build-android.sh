#!/usr/bin/env bash
# Capacitor で Android APK をビルドする。
# Web 静的ビルド（frontend/dist）を WebView アプリとして包む。
# 成果物: /app/output/android/app-debug.apk
set -euo pipefail

cd /app
OUT=/app/output/android
mkdir -p "$OUT"

echo "==> [1/5] Web 静的コンテンツをビルド"
( cd frontend && npm install && npm run build )

echo "==> [2/5] Capacitor ツールをインストール"
npm install

echo "==> [3/5] Android プロジェクトを生成（未生成なら追加）"
if [ ! -d android ]; then
  npx cap add android
else
  npx cap sync android
fi
npx cap copy android

echo "==> [4/5] Gradle で APK をビルド"
( cd android && chmod +x ./gradlew && ./gradlew assembleDebug )

echo "==> [5/5] 成果物をコピー"
cp android/app/build/outputs/apk/debug/app-debug.apk "$OUT/"

echo ""
echo "==================================================="
echo " 完了: $OUT/app-debug.apk"
echo "==================================================="
