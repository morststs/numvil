# CLAUDE.md

このファイルは、本リポジトリで作業する Claude Code（claude.ai/code）向けのガイドです。

## このプロジェクトについて

「Numvil（計算パズル）」— 計算のパズルゲーム。プレイヤーは各1個のパーツ
（`0123456789()!+-/*^`）を「式」に並べ、「題」の数を作る。
元の仕様は `doc/指示書01.md`（日本語）を参照。

## アーキテクチャ — まず押さえるべき1点

**ゲームのロジックはすべてフロントエンドにある**（Go 側には無い）。中核は
`frontend/src/lib/engine.js`：再帰下降パーサ／評価器＋問題ジェネレータ。
Go/Wails 層（`main.go`・`app.go`）は `frontend/dist` を `//go:embed` で埋め込む
だけの薄いデスクトップシェルで、ビジネスロジックを持たない。これは意図的な設計で、
同じ Svelte ビルドを 3 通り — **Web 静的**・**Wails デスクトップ**（Windows exe）・
**Capacitor Android**（WebView）— で動かすため、ロジックがバックエンドに
依存してはいけない。

ゲームのルールを変えるときは `engine.js` だけを編集する。Svelte の UI（`App.svelte`）は
表示とドラッグ&ドロップの配線に徹している。

### エンジンの不変条件（engine.js）

- 数字は **1桁のオペランド**。文法上オペランド間に演算子が必須なので、隣接する数字
  （例：`1 0`）は解析に失敗する — これが「2桁以上の数は作れない」ルールの担保方法。
  暗黙の連結・暗黙の乗算を追加しないこと。
- 演算子の優先順位：`!`（階乗）> `^`（べき乗・右結合）> 単項 `-` > `* /` > `+ -`。
- `generateProblem(level)` は「各1個」のパレットからランダムな有効式を組み立て、その値を
  題にする — これにより解の存在を保証する。生成した式は `answer` として返し、降参時に
  表示する。ジェネレータを触るときは **`(` `)` が各1個、各演算子も1個**という制約を守る。

## コマンド

```bash
# フロントエンドの開発／テスト（Node 22）
cd frontend && npm install
npm run dev          # Web プレビュー（:5173）
npm run build        # -> frontend/dist（Web 静的成果物）
npm test             # node test/engine.test.mjs — engine.js を変更したら必ず実行

# 実ブラウザのスモークテスト（任意・要 playwright）
npm i -D playwright && npx playwright install chromium
node test/smoke.mjs

# マルチターゲットの一括ビルド（要 Docker）
docker compose up --build                              # web + windows exe -> ./output
docker compose --profile android up --build android    # android apk -> ./output/android
```

ローカルに Go ツールチェインは前提としない。Go のビルドは Docker イメージ内で行う
（`scripts/build.sh` が `go mod tidy` → `wails build` を実行）。`go.sum` はコンテナ内で
生成され、gitignore 済み。

## 規約

- Svelte 5 の **runes**（`$state`・`$derived`・`$effect`）を使う — 旧来の store/
  リアクティブ構文は使わない。
- TailwindCSS 4 は `@tailwindcss/vite` 経由。全体設定は `frontend/src/style.css`
  （`@import "tailwindcss"` ＋ flowbite プラグイン）。`tailwind.config.js` は無い。
- `vite.config.js` で `base: './'` を指定し、任意のホストパス／`file://`／Wails の
  いずれでも assets を解決できるようにしている。
- UI 文言とコメントは日本語（仕様・参考リポジトリに合わせる）。
