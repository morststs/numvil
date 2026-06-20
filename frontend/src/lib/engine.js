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

// level: 1=やさしい / 2=ふつう / 3=むずかしい
export function generateProblem(level = 1) {
  const maxTarget = level <= 1 ? 20 : level === 2 ? 50 : 99;
  const kChoices = level <= 1 ? [2] : level === 2 ? [2, 3] : [3, 4];
  const ops = level <= 1 ? ['+', '-', '*'] : level === 2 ? ['+', '-', '*', '/'] : ['+', '-', '*', '/', '^'];

  for (let attempt = 0; attempt < 5000; attempt++) {
    const k = pick(kChoices);
    const digits = shuffle(DIGIT_PARTS).slice(0, k); // 相異なる数字（各1個制約を満たす）
    const opsPool = shuffle(ops);
    if (k - 1 > opsPool.length) continue;
    const opseq = opsPool.slice(0, k - 1); // 相異なる演算子（各1個制約）

    let tokens = [];
    for (let i = 0; i < k; i++) {
      tokens.push(digits[i]);
      if (i < k - 1) tokens.push(opseq[i]);
    }

    // 確率で先頭の2項を1組の括弧で囲む（括弧は各1個なので1グループのみ）
    if (level >= 2 && k >= 3 && Math.random() < 0.4) {
      tokens = ['(', tokens[0], tokens[1], tokens[2], ')', ...tokens.slice(3)];
    }

    // 確率で小さい数字に階乗を付ける（!は1個）
    if (level >= 2 && Math.random() < 0.3) {
      const idxs = [];
      for (let i = 0; i < tokens.length; i++) {
        if (/[0-4]/.test(tokens[i])) idxs.push(i);
      }
      if (idxs.length) {
        const at = pick(idxs);
        tokens.splice(at + 1, 0, '!');
      }
    }

    const res = evaluate(tokens);
    if (!res.ok) continue;
    const v = res.value;
    if (Math.abs(v - Math.round(v)) > 1e-9) continue; // 整数の題のみ
    const target = Math.round(v);
    if (target < 1 || target > maxTarget) continue;

    return { target, answer: tokens.slice(), level };
  }

  // フォールバック（理論上ほぼ到達しない）
  return { target: 3, answer: ['1', '+', '2'], level };
}
