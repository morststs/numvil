# Numvil（計算パズル）

数字と記号のパーツを「式」に並べて「題」の数を作る計算パズルゲーム。
名前は num（数）＋ anvil（金床）＝「数を鍛えて組み立てる」より。

**フロントエンドのみの静的サイト**として動作し、GitHub Pages で公開しています。
バックエンドはありません。

4つのペインで構成されます。

- **題** … 作るべき数値が表示される
- **パーツ** … `0123456789()!+-/*^` が各1個。ドラッグ／タップで「式」に置ける
- **式** … パーツを並べる場所。計算可能なら結果を表示
- **結果** … 現在の式の計算結果。題と一致するとクリア

## モード

- **Endless** … ランダム生成される問題を解き続けるフリープレイ。難易度3段階（Easy / Normal / Expert）。降参で答えの一例を表示。
- **Challenge（出題モード）** … あらかじめ決まった 5レベル × 各10問。クリア履歴と使った数式をブラウザの localStorage に保存し、レベル選択画面に進捗（`n/10`・🏆・各問題の✓）を表示。答えは見られない。

## ルール

- パーツは各1個。**1つの式で同じパーツは1回まで**使える
- **2つの数字を並べて2桁以上の数は作れない**（例：`1` と `0` で `10` は不可）
- 題には必ず1つ以上の解がある
- 演算子の優先順位：`!`（階乗）> `^`（べき乗・右結合）> 単項マイナス > `* /` > `+ -`
- UI は英語表示（ダークなクール配色）

## 技術スタック

| 層 | 採用技術 |
|----|----------|
| フレームワーク | Svelte 5（runes）+ Vite 7 |
| UI | Flowbite Svelte 1.x + TailwindCSS 4（@tailwindcss/vite）|
| 公開 | GitHub Pages（`.github/workflows/deploy.yml`）|

ゲームのロジック（式の評価・問題生成）はすべて `frontend/src/lib/engine.js` に実装。
バックエンドは不要です。

## 開発

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 で確認
npm test         # 計算エンジン＋出題モードのテスト
npm run build    # -> frontend/dist（静的成果物）
```

## 公開（GitHub Pages）

`main` への push で `.github/workflows/deploy.yml` が動き、`frontend/dist` を
ビルドして GitHub Pages へデプロイします（手動実行も可）。

## 出題モードの問題集の再生成

```bash
cd frontend
node scripts/gen-problems.mjs > src/lib/problems.js
```

決定論 RNG（seed 固定）で 5レベル × 各10問を生成し、各問の解答例をコメントに併記します
（解答例は画面には出ません）。

## ディレクトリ構成

```
.
├── .github/workflows/deploy.yml   # GitHub Pages デプロイ
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── scripts/gen-problems.mjs   # 出題モードの問題集ジェネレータ
    ├── src/
    │   ├── App.svelte             # UI
    │   ├── main.js
    │   ├── style.css
    │   └── lib/
    │       ├── engine.js          # 式評価・問題生成（コアロジック）
    │       ├── problems.js        # 出題モードの固定問題集
    │       └── storage.js         # クリア履歴（localStorage）
    └── test/                      # engine / challenge / smoke テスト
```
