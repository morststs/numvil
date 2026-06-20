#!/usr/bin/env bash
# docker compose up から呼ばれるビルドスクリプト。
# 成果物を /app/output 配下にまとめる:
#   output/web      … Web 静的コンテンツ（そのまま静的ホスティング可能）
#   output/windows  … Windows 用 exe
set -euo pipefail

cd /app
OUT=/app/output
mkdir -p "$OUT/web" "$OUT/windows"

echo "==> [1/4] フロントエンド依存をインストール"
( cd frontend && npm install )

echo "==> [2/4] Web 静的コンテンツをビルド"
( cd frontend && npm run build )
cp -r frontend/dist/. "$OUT/web/"
echo "    -> $OUT/web"

echo "==> [3/4] Go モジュールを解決"
go mod tidy

echo "==> [4/4] Windows exe をビルド（wails / 既ビルドのフロントを再利用: -s）"
wails build -platform windows/amd64 -s -o numvil.exe
cp build/bin/numvil.exe "$OUT/windows/"
echo "    -> $OUT/windows/numvil.exe"

echo ""
echo "==================================================="
echo " 完了: 成果物は ./output 配下にあります"
echo "   - Web:     ./output/web/index.html"
echo "   - Windows: ./output/windows/numvil.exe"
echo " Android は ./scripts/build-android.sh を参照"
echo "   （docker compose --profile android up android）"
echo "==================================================="
