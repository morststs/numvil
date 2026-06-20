// 計算パズル：式の評価エンジンと問題ジェネレータ
//
// パーツは「0123456789()!+-/*^」が各1個。式に並べたトークン列を解析・計算する。
// 重要ルール：2つの数字を並べて2桁以上の数（例: 1 と 0 で 10）は作れない。
// これは文法上、数字と数字の間に演算子が無いと解析エラーになることで自然に担保される。

export const DIGIT_PARTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const OP_PARTS = ['(', ')', '!', '+', '-', '/', '*', '^'];
export const PARTS = [...DIGIT_PARTS, ...OP_PARTS];

// オーバーフロー防止のための絶対値上限
const MAX_VALUE = 1e12;

function isDigit(t) {
  return t >= '0' && t <= '9';
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error('階乗は0以上の整数のみ');
  let r = 1;
  for (let k = 2; k <= n; k++) {
    r *= k;
    if (r > MAX_VALUE) throw new Error('overflow');
  }
  return r;
}

// 再帰下降パーサ
//   expr    := term (('+' | '-') term)*
//   term    := factor (('*' | '/') factor)*
//   factor  := ('-' | '+') factor | power      // 単項
//   power   := postfix ('^' factor)?           // 右結合
//   postfix := primary ('!')*
//   primary := digit | '(' expr ')'
class Parser {
  constructor(tokens) {
    this.t = tokens;
    this.i = 0;
  }
  peek() {
    return this.t[this.i];
  }
  next() {
    return this.t[this.i++];
  }
  atEnd() {
    return this.i >= this.t.length;
  }
  guard(v) {
    if (!Number.isFinite(v) || Math.abs(v) > MAX_VALUE) throw new Error('overflow');
  }

  parse() {
    const v = this.parseExpr();
    if (!this.atEnd()) throw new Error('余分なトークン: ' + this.peek());
    return v;
  }

  parseExpr() {
    let v = this.parseTerm();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.next();
      const r = this.parseTerm();
      v = op === '+' ? v + r : v - r;
      this.guard(v);
    }
    return v;
  }

  parseTerm() {
    let v = this.parseFactor();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.next();
      const r = this.parseFactor();
      if (op === '/') {
        if (r === 0) throw new Error('0除算');
        v = v / r;
      } else {
        v = v * r;
      }
      this.guard(v);
    }
    return v;
  }

  parseFactor() {
    if (this.peek() === '-') {
      this.next();
      return -this.parseFactor();
    }
    if (this.peek() === '+') {
      this.next();
      return this.parseFactor();
    }
    return this.parsePower();
  }

  parsePower() {
    const base = this.parsePostfix();
    if (this.peek() === '^') {
      this.next();
      const exp = this.parseFactor(); // 右結合・指数側に単項を許可
      const v = Math.pow(base, exp);
      this.guard(v);
      return v;
    }
    return base;
  }

  parsePostfix() {
    let v = this.parsePrimary();
    while (this.peek() === '!') {
      this.next();
      v = factorial(v);
      this.guard(v);
    }
    return v;
  }

  parsePrimary() {
    const t = this.peek();
    if (t === undefined) throw new Error('式が途中で終了');
    if (t === '(') {
      this.next();
      const v = this.parseExpr();
      if (this.next() !== ')') throw new Error(') が不足');
      return v;
    }
    if (isDigit(t)) {
      this.next();
      return Number(t);
    }
    throw new Error('解析できないトークン: ' + t);
  }
}

// トークン配列を評価する。
// 返り値: { ok: true, value } または { ok: false, error }
export function evaluate(tokens) {
  if (!tokens || tokens.length === 0) return { ok: false, error: 'empty' };
  try {
    const v = new Parser(tokens).parse();
    if (!Number.isFinite(v)) return { ok: false, error: 'invalid' };
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 結果が目標値に一致するか（浮動小数の誤差を許容）
export function matchesTarget(value, target) {
  return Math.abs(value - target) < 1e-9;
}

// ---- 問題ジェネレータ ----
// 利用可能パーツ（各1個）の範囲で、有効な式をランダム生成し、その計算結果を「題」とする。
// 生成した式自体が必ず解になるため「1つ以上の回答の式がある」を保証する。降参時はこの式を表示。

function randInt(n) {
  return Math.floor(Math.random() * n);
}
function pick(arr) {
  return arr[randInt(arr.length)];
}
function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// レベル設定：上に行くほど「項数が多い・目標値が大きく中途半端・括弧/階乗/べき乗が必須」になる。
//   ks            : オペランド（数字）の個数の候補
//   ops           : 使う二項演算子
//   min/max       : 題（目標値）のレンジ。min を上げるほど自明な小さい解が消えて難しくなる
//   parenP        : 括弧を1組使う確率（requireParen=true なら必ず使う）
//   factP/factMax : 階乗を付ける確率と、付けてよい数字の上限
//   requireAdvanced : 答えに ^ か ! を必ず含める（高度な演算が必要）
//   requireParen    : 答えに括弧を必ず含める
const LEVEL_CONFIG = {
  // 1=Easy（題は2桁以上＝1桁にしない）
  1: { ks: [2],    ops: ['+', '-', '*'],           min: 10, max: 20,  parenP: 0,    factP: 0,    factMax: 0, requireAdvanced: false, requireParen: false },
  // 2=Normal（題は2桁以上）
  2: { ks: [2, 3], ops: ['+', '-', '*', '/'],      min: 10, max: 50,  parenP: 0.3,  factP: 0.25, factMax: 4, requireAdvanced: false, requireParen: false },
  // 3=Expert（4〜5項・目標80〜800・括弧と^/!の両方必須）
  3: { ks: [4, 5], ops: ['+', '-', '*', '/', '^'], min: 80, max: 800, parenP: 1,    factP: 0.7,  factMax: 6, requireAdvanced: true,  requireParen: true },
};

// level: 1=Easy / 2=Normal / 3=Expert
export function generateProblem(level = 1) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];

  for (let attempt = 0; attempt < 20000; attempt++) {
    const k = pick(cfg.ks);
    const digits = shuffle(DIGIT_PARTS).slice(0, k); // 相異なる数字（各1個制約を満たす）
    const opsPool = shuffle(cfg.ops);
    if (k - 1 > opsPool.length) continue;
    const opseq = opsPool.slice(0, k - 1); // 相異なる演算子（各1個制約）

    let tokens = [];
    for (let i = 0; i < k; i++) {
      tokens.push(digits[i]);
      if (i < k - 1) tokens.push(opseq[i]);
    }

    // 括弧（1組のみ）：先頭の「数字 演算子 数字」を囲んで優先順位を変える
    const wantParen = k >= 3 && (cfg.requireParen || Math.random() < cfg.parenP);
    if (wantParen) {
      tokens = ['(', tokens[0], tokens[1], tokens[2], ')', ...tokens.slice(3)];
    }

    // 階乗（!は1個）：小さい数字に付ける
    if (cfg.factP > 0 && Math.random() < cfg.factP) {
      const re = new RegExp('^[0-' + cfg.factMax + ']$');
      const idxs = [];
      for (let i = 0; i < tokens.length; i++) {
        if (re.test(tokens[i])) idxs.push(i);
      }
      if (idxs.length) {
        const at = pick(idxs);
        tokens.splice(at + 1, 0, '!');
      }
    }

    // レベル要件のチェック
    if (cfg.requireParen && !tokens.includes('(')) continue;
    if (cfg.requireAdvanced && !tokens.includes('^') && !tokens.includes('!')) continue;

    const res = evaluate(tokens);
    if (!res.ok) continue;
    const v = res.value;
    if (Math.abs(v - Math.round(v)) > 1e-9) continue; // 整数の題のみ
    const target = Math.round(v);
    if (target < cfg.min || target > cfg.max) continue;

    return { target, answer: tokens.slice(), level };
  }

  return fallbackProblem(level);
}

// 生成に失敗した場合の保険（各レベルの要件を満たす固定問題）
function fallbackProblem(level) {
  const FB = {
    1: { target: 12, answer: ['3', '*', '4'] },
    2: { target: 23, answer: ['5', '*', '4', '+', '3'] },
    3: { target: 107, answer: ['(', '1', '+', '4', ')', '^', '3', '-', '9', '*', '2'] }, // (1+4)^3-9*2
  };
  const f = FB[level] || FB[1];
  return { target: f.target, answer: f.answer.slice(), level };
}
