# skills.md — Numvil 開発に必要なスキル

このプロジェクト（計算パズル「Numvil」）を開発・保守するために必要なスキルを、
**実際にリポジトリで使っている技術**に沿って整理する。各項目に「用途」「主な対象ファイル」
「必要度」を付す。必要度は ★★★=必須 / ★★=推奨 / ★=あると良い。

> アーキテクチャ上の要点：ゲームのロジックはすべて **フロントエンド**（`frontend/src/lib/engine.js`）に
> あり、Go/Wails はそれを埋め込むデスクトップシェルにすぎない。よって比重は「フロントエンド > ビルド/配布 > Go」。

---

## 1. フロントエンド（最重要）

### Svelte 5（runes） ★★★
- **用途**: UI 全体。状態管理を `$state` / `$derived` で行い、ドラッグ＆ドロップや正解判定を実装。
- **対象**: `frontend/src/App.svelte`, `frontend/src/main.js`
- **押さえどころ**: `$state`・`$derived`・`{#each ... (key)}`・`onclick`/`ondragstart` などの新しいイベント属性。旧来の `export let` / ストア構文ではなく **runes** を使う。

### JavaScript（ES Modules）＋アルゴリズム ★★★
- **用途**: 式の評価器（再帰下降パーサ）と、解の存在を保証する問題ジェネレータ。
- **対象**: `frontend/src/lib/engine.js`
- **押さえどころ**: 演算子優先順位・再帰下降構文解析・右結合（べき乗）・後置演算子（階乗）・数値の範囲/オーバーフロー対策。難易度調整はこのファイルの `LEVEL_CONFIG` を触る。

### HTML5 ドラッグ＆ドロップ API ★★
- **用途**: パレット→式への追加、式内パーツの並べ替え。
- **対象**: `App.svelte`（`paletteDragStart` / `placedDragStart` / `buildDrop` / `commitDrop` など）
- **押さえどころ**: `dragstart`/`dragover`(preventDefault が必須)/`drop`/`dragend`、`dataTransfer`、デスクトップ専用である点（タッチ非対応）。

### TailwindCSS 4（@tailwindcss/vite） ★★
- **用途**: 全スタイリング。ユーティリティクラス中心。
- **対象**: `frontend/src/style.css`（`@import "tailwindcss"` ＋ flowbite プラグイン）, 各 `.svelte` の class
- **押さえどころ**: v4 は設定ファイル（`tailwind.config.js`）不要・CSS ファースト。`@source` でクラス抽出対象を指定。レスポンシブ接頭辞（`sm:` 等）。

### Flowbite Svelte 1.x ★
- **用途**: ボタン・バッジ等の UI コンポーネント。
- **対象**: `App.svelte`（`import { Button, Badge } from 'flowbite-svelte'`）
- **押さえどころ**: コンポーネントの `color` プロップなど。使用は最小限なので浅くてよい。

---

## 2. ビルド・配布

### Vite 7 ★★
- **用途**: 開発サーバー（HMR）と Web 静的ビルド。
- **対象**: `frontend/vite.config.js`, `frontend/package.json` の scripts
- **押さえどころ**: `base: './'` の意味（任意パス/Wails/`file://` で動かす）、`dev` / `dev:host` / `build` / `preview`。

### Go 1.23 + Wails v2.12 ★★
- **用途**: フロントを埋め込む Windows/デスクトップアプリ化。
- **対象**: `main.go`, `app.go`, `wails.json`, `go.mod`
- **押さえどころ**: `//go:embed all:frontend/dist`、`wails build -platform windows/amd64`、最小限の `App` 構造体。Go のロジック実装はほぼ不要（薄いシェル）。

### Docker / docker compose ★★
- **用途**: 「`docker compose up` でビルド」を実現。Web+Windows、別プロファイルで Android。
- **対象**: `Dockerfile`, `Dockerfile.android`, `docker-compose.yml`, `scripts/build.sh`, `scripts/build-android.sh`
- **押さえどころ**: マルチステージ的な役割分担、ボリュームキャッシュ、`--profile android`、コンテナ内で `go mod tidy`→`wails build`。

### Capacitor 7（Android） ★
- **用途**: Web 静的ビルドを WebView で包んで APK 化。
- **対象**: `capacitor.config.json`, `package.json`(ルート), `scripts/build-android.sh`
- **押さえどころ**: `webDir=frontend/dist`、`cap add/sync/copy`、Gradle `assembleDebug`、Android SDK 前提。※本環境では未検証のベストエフォート。

---

## 3. 品質・テスト

### Node.js テスト（自作ハーネス） ★★
- **用途**: 評価器・ジェネレータの単体テスト。
- **対象**: `frontend/test/engine.test.mjs`（`npm test`）
- **押さえどころ**: 期待値比較、ジェネレータの不変条件（解＝題が一致／パーツ各1個／難易度要件）の検証。

### Playwright（実ブラウザのスモークテスト） ★
- **用途**: 実 Chromium で UI 操作を検証（マウント/正解/並べ替え/不正式/コンソールエラー）。
- **対象**: `frontend/test/smoke.mjs`
- **押さえどころ**: `vite preview` で配信→`page` 操作、`getByRole`/`locator`、`dragTo` による DnD。実行には `npx playwright install --with-deps chromium` が必要。

---

## 4. 開発環境・運用

### Git / GitHub ★★
- **用途**: バージョン管理、private リポジトリ（`morststs/numvil`）への push。
- **押さえどころ**: コミット、`.gitignore`（`node_modules`/`dist`/`output`/`pat.txt` 等を除外）、リモート操作、PAT の扱い（classic `repo` スコープ or fine-grained の Contents 権限）。

### VS Code / Dev Containers ★★
- **用途**: コンテナ内開発、ポート転送、「実行とデバッグ」からの Vite 起動。
- **対象**: `.vscode/launch.json`, `.vscode/tasks.json`
- **押さえどころ**: PORTS パネルでの 5173 転送、`forwardPorts` は再ビルド/再オープンで反映、`launch.json` の `preLaunchTask`。

### 日本語ドキュメンテーション ★
- **用途**: UI 文言・コメント・ドキュメントは日本語で統一。
- **対象**: `README.md`, `CLAUDE.md`, 各種コメント

---

## 5. 最短キャッチアップの順序（推奨）

1. **Svelte 5 runes** と **JS（engine.js の構文解析）** … ここが本体
2. **Vite**（`npm run dev:host` で動かす）と **Tailwind**（見た目を触る）
3. **Node テスト**（`npm test`）で壊さない開発サイクルを回す
4. **Docker / Wails** … 配布物（exe / web）を作る段で学ぶ
5. **Capacitor / Playwright** … 必要になったら

> 「ゲームのルールや難易度を変えたい」なら **1（engine.js）だけ**でよい。
> 「見た目を変えたい」なら **Svelte + Tailwind**。配布で初めて **Go/Docker** が要る。
