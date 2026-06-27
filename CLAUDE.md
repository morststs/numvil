# CLAUDE.md

このファイルは、本リポジトリで作業する Claude Code（claude.ai/code）向けのガイドです。

## このプロジェクトについて

「Numvil（計算パズル）」— 計算のパズルゲーム。プレイヤーは各1個のパーツ
（`0123456789()!+-/*^`）を「式」に並べ、「題」の数を作る。
元の仕様は `doc/指示書01.md`（Endless）・`doc/指示書02.md`（出題モード）を参照。

## アーキテクチャ — まず押さえるべき1点

**フロントエンドのみの静的サイト**で、バックエンドは無い。ゲームのロジック（式の
評価・問題生成）はすべて `frontend/src/lib/engine.js`（再帰下降パーサ／評価器＋問題
ジェネレータ）にある。`main` への push で `.github/workflows/deploy.yml` が
`frontend/dist` をビルドして GitHub Pages に公開する。

ゲームのルールを変えるときは `engine.js`（Endless）／`scripts/gen-problems.mjs`
（出題モードの問題集）を編集する。UI（`App.svelte`）は表示とドラッグ&ドロップの配線に徹している。

### モード
- **Endless**：`engine.js` の `generateProblem(level)` がランダムに問題を生成（Easy/Normal/Expert）。
- **出題モード（Challenge）**：`src/lib/problems.js` の固定問題集（5レベル×10問）。クリア履歴と
  使った数式を `src/lib/storage.js` 経由で localStorage に保存し、レベル選択画面に進捗を表示する。

### エンジンの不変条件（engine.js）

- 数字は **1桁のオペランド**。文法上オペランド間に演算子が必須なので、隣接する数字
  （例：`1 0`）は解析に失敗する — これが「2桁以上の数は作れない」ルールの担保方法。
  暗黙の連結・暗黙の乗算を追加しないこと。
- 演算子の優先順位：`!`（階乗）> `^`（べき乗・右結合）> 単項 `-` > `* /` > `+ -`。
- `generateProblem(level)` は「各1個」のパレットからランダムな有効式を組み立て、その値を
  題にする — これにより解の存在を保証する。生成した式は `answer` として返し、降参時に
  表示する。ジェネレータを触るときは **`(` `)` が各1個、各演算子も1個**という制約を守る。

### 出題モードの問題集（problems.js / gen-problems.mjs）

- `src/lib/problems.js` は `scripts/gen-problems.mjs`（seed 固定の決定論 RNG）で生成。
  各問の解答例はコメントに併記する（画面には出さない）。難易度の狙いはスクリプト冒頭のコメント参照。
- **注意**：階乗 `!` が使えるため `[2,999]` の整数は ÷・括弧なしでも事実上すべて到達可能。よって
  「割り算でしか解けない／括弧でしか解けない」整数題は作れない。各レベルは "解答例がその要素を使う"
  ＋ "題の桁・大きさ" で難易度を表現している。

## コマンド

```bash
cd frontend && npm install
npm run dev          # Web プレビュー（:5173）
npm run build        # -> frontend/dist（静的成果物）
npm test             # engine.test.mjs + challenge.test.mjs

# 出題モードの問題集を再生成
node scripts/gen-problems.mjs > src/lib/problems.js

# 実ブラウザのスモークテスト（任意・要 playwright）
npm i -D playwright && npx playwright install chromium
node test/smoke.mjs
```

## 規約

- Svelte 5 の **runes**（`$state`・`$derived`・`$effect`）を使う — 旧来の store/
  リアクティブ構文は使わない。
- TailwindCSS 4 は `@tailwindcss/vite` 経由。全体設定は `frontend/src/style.css`
  （`@import "tailwindcss"` ＋ flowbite プラグイン）。`tailwind.config.js` は無い。
- `vite.config.js` で `base: './'` を指定し、任意のホストパスで assets を解決できるようにしている。
- **UI 文言は英語**（ダークなクール配色テーマ）。コードのコメントとドキュメント（README/CLAUDE/skills）は日本語。
- Endless の難易度は3段階：`engine.js` の `LEVEL_CONFIG` のキー `1=Easy / 2=Normal / 3=Expert`。
  `App.svelte` の `LEVELS` と対応。
