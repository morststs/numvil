# Numvil（計算パズル）

数字と記号のパーツを「式」に並べて「題」の数を作る計算パズルゲーム。
名前は num（数）＋ anvil（金床）＝「数を鍛えて組み立てる」より。

4つのペインで構成されます。

- **題** … 作るべき数値が表示される
- **パーツ** … `0123456789()!+-/*^` が各1個。ドラッグ／タップで「式」に置ける
- **式** … パーツを並べる場所。計算可能なら結果を表示
- **結果** … 現在の式の計算結果。題と一致するとクリア

## ルール

- パーツは各1個。**1つの式で同じパーツは1回まで**使える
- **2つの数字を並べて2桁以上の数は作れない**（例：`1` と `0` で `10` は不可）
- 題には必ず1つ以上の解がある
- **降参**すると答えの一例が表示される
- 難易度（やさしい／ふつう／むずかしい）を切り替え可能。むずかしいでは `^`・`!`・`()` も登場

演算子の優先順位は一般的な数学に準拠：`!`（階乗）> `^`（べき乗・右結合）> 単項マイナス > `* /` > `+ -`。

## 技術スタック

| 層 | 採用技術 |
|----|----------|
| バックエンド | Go 1.23 + Wails v2.12 |
| フロントエンド | Svelte 5（runes）+ Vite 7 |
| UI | Flowbite Svelte 1.x + TailwindCSS 4（@tailwindcss/vite）|
| Android | Capacitor（Web 静的ビルドを WebView で包む）|

ゲームのロジック（式の評価・問題生成）は **フロントエンド** の
`frontend/src/lib/engine.js` に実装しています。これにより Web 静的配信でも
バックエンド無しで完全に動作し、同じ成果物を Wails（デスクトップ）・
Capacitor（Android）で再利用します。

## ビルド（docker compose）

```bash
# Web 静的コンテンツ + Windows exe を ./output に出力
docker compose up --build
```

成果物：

- `output/web/index.html` … Web 静的コンテンツ（任意の静的ホスティングに配置可）
- `output/windows/numvil.exe` … Windows 実行ファイル

### Android（APK）

```bash
docker compose --profile android up --build android
# -> output/android/app-debug.apk
```

> Android ビルドは Android SDK のダウンロードを伴います。Capacitor 7 系を使用。

## 開発（ローカル）

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 で Web 版を確認
npm test         # 計算エンジンのテスト
```

Wails のデスクトップ開発（要 Go + Wails CLI）：

```bash
wails dev
```

## ディレクトリ構成

```
.
├── main.go / app.go         # Wails エントリ（frontend/dist を埋め込み）
├── wails.json               # Wails 設定
├── Dockerfile               # Web + Windows ビルド用イメージ
├── Dockerfile.android       # Android(Capacitor) ビルド用イメージ
├── docker-compose.yml       # docker compose up でビルド
├── capacitor.config.json    # Capacitor 設定（webDir=frontend/dist）
├── scripts/
│   ├── build.sh             # Web + Windows
│   └── build-android.sh     # Android APK
└── frontend/
    ├── index.html
    ├── src/
    │   ├── App.svelte        # 4ペインの UI
    │   ├── main.js
    │   ├── style.css
    │   └── lib/engine.js     # 式評価・問題生成（コアロジック）
    └── test/engine.test.mjs  # エンジンのテスト
```

参考：[morststs/sirusita](https://github.com/morststs/sirusita)（Wails + Svelte5 + Flowbite の構成を踏襲）
