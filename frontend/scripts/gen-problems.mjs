// 出題モード用の固定問題集（src/lib/problems.js）を生成するスクリプト。
//   実行: node frontend/scripts/gen-problems.mjs > frontend/src/lib/problems.js
//
// 難易度仕様（レベルごとの「狙い」＝解答例がその要素を使う）:
//   L1: 掛け算と、足し算か引き算のどちらかを使う。題は 20 以上。
//   L2: 掛け算・足し算・引き算の3つすべてを使う。
//   L3: 括弧を使う（括弧テーマ）。
//   L4: 階乗(!)かべき乗(^)を使う。題は3桁(100〜999)。
//   L5: 全演算子（+ − × ÷ ^ !）と括弧をすべて1個ずつ使う。
//
// 出題モードでは解答例は画面に出さない（このファイルのコメントにのみ残す）。
//
// ■ 設計メモ：「特定の演算子/括弧が"必須"」は作れない
//   パーツは各1個（数字0-9, () ! + - / * ^ 各1個）。階乗 ! が使えるため、÷や括弧を
//   使わなくても [2,999] の整数は事実上すべて到達可能（全列挙で確認済み）。よって
//   「割り算でしか作れない／括弧でしか作れない題」は存在しない。そこで各レベルは
//   "解答例がその要素を使う" ＋ "題の桁・大きさ" で難易度を表現する（厳密な必須性は問わない）。
import { evaluate, matchesTarget } from '../src/lib/engine.js';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// 「掛け算のみ」で出せる題＝相異なる一桁×一桁の積（'*' は1個しか使えないので2数字の積だけ）。
// L1/L2 はこの集合の題を除外し、+ / − が必ず効くようにする。
const PURE_MULT = new Set();
for (let i = 1; i <= 9; i++) for (let j = i + 1; j <= 9; j++) PURE_MULT.add(i * j);

// ---- 決定論 RNG（mulberry32）。seed を変えれば別の問題集になる ----
const SEED = 20260627;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(SEED);
const randInt = (n) => Math.floor(rnd() * n);
const pick = (a) => a[randInt(a.length)];
function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// digits（長さk）・ops（長さk-1, 二項演算子）・括弧範囲 pr=[i,j]|null からトークン列を組む。
function buildTokens(digits, ops, pr) {
  const k = digits.length;
  const t = [];
  for (let m = 0; m < k; m++) {
    if (pr && m === pr[0]) t.push('(');
    t.push(digits[m]);
    if (pr && m === pr[1]) t.push(')');
    if (m < k - 1) t.push(ops[m]);
  }
  return t;
}

// ランダムに「式（解答例）」を作るビルダー（各パーツ1個制約を厳守）。
// opts:
//   k        : オペランド数
//   ops      : 使ってよい二項演算子の母集合（この中から k-1 個を相異なるよう選ぶ）
//   forceOps : 必ず含める二項演算子（配列）
//   paren    : 'maybe' | 'always' | 'never'
//   fact     : 'maybe' | 'always' | 'never'  （階乗 ! を1個付ける）
//   divisorOne: true なら '/' の右オペランドを必ず '1' にする（÷を整数保存にする）
function genExpr(opts) {
  const k = opts.k;
  // excludeZero: '0' を使わない（×0 で潰す小細工を防ぐ＝L5用）
  const srcDigits = opts.excludeZero ? DIGITS.slice(1) : DIGITS;
  const digits = shuffle(srcDigits).slice(0, k);

  // 二項演算子列（forceOps を含み、相異なる）
  const need = (opts.forceOps || []).slice();
  if (need.length > k - 1) return null;
  const rest = shuffle(opts.ops.filter((o) => !need.includes(o)));
  const chosen = shuffle([...need, ...rest.slice(0, k - 1 - need.length)]);
  if (chosen.length !== k - 1) return null;

  // '/' の右を '1' にしたい場合、'1' を除数の位置へ寄せる
  if (opts.divisorOne && chosen.includes('/')) {
    const di = chosen.indexOf('/');
    const onePos = digits.indexOf('1');
    if (onePos === -1) return null;
    const tmp = digits[di + 1];
    digits[di + 1] = '1';
    digits[onePos] = tmp;
  }

  // 括弧
  let pr = null;
  const wantParen = opts.paren === 'always' || (opts.paren === 'maybe' && rnd() < 0.6);
  if (wantParen && k >= 3) {
    const i = randInt(k - 1);
    const j = i + 1 + randInt(k - 1 - i);
    pr = [i, j];
  } else if (opts.paren === 'always') {
    return null;
  }

  // 階乗（小さい数字 <=4 の直後に付けて overflow を避ける）
  let tokens = buildTokens(digits, chosen, pr);
  const wantFact = opts.fact === 'always' || (opts.fact === 'maybe' && rnd() < 0.5);
  if (wantFact) {
    const cand = [];
    for (let p = 0; p < tokens.length; p++) {
      const tk = tokens[p];
      if (tk >= '0' && tk <= '4') cand.push(p);
    }
    if (!cand.length) {
      if (opts.fact === 'always') return null;
    } else {
      const at = pick(cand);
      tokens = [...tokens.slice(0, at + 1), '!', ...tokens.slice(at + 1)];
    }
  } else if (opts.fact === 'always') {
    return null;
  }

  const r = evaluate(tokens);
  if (!r.ok) return null;
  const v = r.value;
  if (Math.abs(v - Math.round(v)) > 1e-9) return null;

  // 括弧が「効いている」ことを要求する場合：括弧を外すと値が変わる（or 壊れる）こと。
  if (opts.meaningfulParen && pr) {
    const noParen = tokens.filter((t) => t !== '(' && t !== ')');
    const r2 = evaluate(noParen);
    if (r2.ok && Math.abs(r2.value - v) < 1e-9) return null; // 括弧が無くても同じ＝意味なし
  }

  return { target: Math.round(v), tokens };
}

const has = (toks, ch) => toks.includes(ch);

// レベルごとの生成設定と採否判定。
const LEVELS = {
  1: {
    // 掛け算＋（足し算か引き算）。題20以上。掛け算だけで出せる題（2数字の積）は除外。
    attempts: 200000,
    gen: () => genExpr({ k: 3, ops: ['+', '-', '*'], forceOps: ['*'], paren: 'never', fact: 'never', excludeZero: true }),
    ok: (p) =>
      p.target >= 20 && p.target <= 80 &&
      has(p.tokens, '*') && (has(p.tokens, '+') || has(p.tokens, '-')) &&
      !PURE_MULT.has(p.target),
  },
  2: {
    // 掛け算・足し算・引き算の3つを使う。L1 より明確に上：題は40以上、掛け算だけの積は除外。
    attempts: 400000,
    gen: () => genExpr({ k: 4, ops: ['+', '-', '*'], forceOps: ['+', '-', '*'], paren: 'maybe', fact: 'never', excludeZero: true }),
    ok: (p) =>
      p.target >= 40 && p.target <= 150 &&
      has(p.tokens, '*') && has(p.tokens, '+') && has(p.tokens, '-') &&
      !PURE_MULT.has(p.target),
  },
  3: {
    // 括弧テーマ：解答例が括弧を使う。3桁だが下側（100〜299）に抑え、L4 より易しくする。
    attempts: 1000000,
    gen: () => genExpr({ k: pick([3, 4, 4]), ops: ['+', '-', '*', '^'], forceOps: [], paren: 'always', fact: 'maybe', meaningfulParen: true, excludeZero: true }),
    ok: (p) =>
      p.target >= 100 && p.target <= 299 &&
      has(p.tokens, '('),
  },
  4: {
    // 階乗/べき乗を使う。3桁の上側（300〜999）＝L3 より明確に難しい。
    attempts: 2000000,
    gen: () => genExpr({ k: pick([3, 4, 4]), ops: ['+', '-', '*', '^'], forceOps: [], paren: 'maybe', fact: 'maybe', excludeZero: true }),
    ok: (p) =>
      p.target >= 300 && p.target <= 999 &&
      (has(p.tokens, '!') || has(p.tokens, '^')),
  },
  5: {
    // 最難レベル：4桁以上・べき乗と階乗の両方・数字5個・意味のある括弧・0なし。
    // ÷は外した（÷1 の小細工で簡単になるのを防ぐ）。k=5 なので + − × ^ を自然に全部使い、
    // さらに ! と括弧も入る＝どのレベルより多くのパーツを使う最難問。
    attempts: 4000000,
    gen: () => genExpr({ k: 5, ops: ['+', '-', '*', '^'], forceOps: ['^'], paren: 'always', fact: 'always', meaningfulParen: true, excludeZero: true }),
    ok: (p) =>
      p.target >= 1000 && p.target <= 99999 &&
      has(p.tokens, '^') && has(p.tokens, '!') && has(p.tokens, '('),
  },
};

// 各レベル10問を生成（レベル内は題の重複を避ける）
const out = {};
for (let level = 1; level <= 5; level++) {
  const cfg = LEVELS[level];
  const seen = new Set();
  const list = [];
  let attempt = 0;
  while (list.length < 10 && attempt++ < cfg.attempts) {
    const p = cfg.gen();
    if (!p) continue;
    if (!cfg.ok(p)) continue;
    if (seen.has(p.target)) continue;
    seen.add(p.target);
    list.push(p);
  }
  if (list.length < 10) {
    console.error(`レベル${level}: ${list.length}/10 しか生成できませんでした（attempts=${attempt}）`);
    process.exit(1);
  }
  out[level] = list;
  process.stderr.write(`レベル${level}: 10問 生成（attempts=${attempt}）\n`);
}

// 最終検証（解が題に一致＋レベル要件＋各パーツ1個）してから出力
for (let level = 1; level <= 5; level++) {
  for (const p of out[level]) {
    const r = evaluate([...p.tokens]);
    if (!r.ok || !matchesTarget(r.value, p.target)) {
      console.error('INVALID（題に一致しない）', level, p); process.exit(1);
    }
    if (!LEVELS[level].ok(p)) {
      console.error('INVALID（レベル要件を満たさない）', level, p); process.exit(1);
    }
    const counts = {};
    for (const t of p.tokens) counts[t] = (counts[t] || 0) + 1;
    const dup = Object.entries(counts).find(([, c]) => c > 1);
    if (dup) { console.error('INVALID（パーツ重複）', level, dup, p); process.exit(1); }
  }
}
process.stderr.write('全問の最終検証 OK\n');

let s = `// 出題モード用の固定問題集（あらかじめ決まった問題）。
// 5レベル × 各10問。プレイヤーには target（題）のみ表示し、解答例は見せない。
// 解答例（answer）は降参表示ではなく、開発参照用にコメントとして併記する。
//   ※ 解は一例。各1個のパーツ制約（0-9, ()!+-/*^ 各1個）を満たす有効式の一つ。
//
// 難易度の狙い（解答例がその要素を使う）:
//   L1: 掛け算＋（足し算か引き算）。題は20以上。
//   L2: 掛け算・足し算・引き算の3つを使う。
//   L3: 括弧を使う。
//   L4: 階乗(!)かべき乗(^)を使う。題は3桁。
//   L5: 全演算子(+ - * / ^ !)と括弧をすべて1個ずつ使う。
// （注）階乗があるため「÷必須／括弧必須」の整数題は存在しない。厳密な必須性ではなく
//       解答例がその要素を使う形で難易度を表現している。
//
// このファイルは scripts/gen-problems.mjs（seed=${SEED}, mulberry32）で生成。手編集も可。

export const CHALLENGE_LEVELS = 5;
export const PROBLEMS_PER_LEVEL = 10;

// 各問題は { target } のみ（答えはコメントの「解答例」を参照）。
export const CHALLENGE_PROBLEMS = {
`;
for (let level = 1; level <= 5; level++) {
  s += `  ${level}: [\n`;
  for (const p of out[level]) {
    s += `    { target: ${p.target} }, // 解答例: ${p.tokens.join('')} = ${p.target}\n`;
  }
  s += `  ],\n`;
}
s += `};\n`;

process.stdout.write(s);
