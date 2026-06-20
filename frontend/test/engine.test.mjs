// 簡易テスト: node frontend/test/engine.test.mjs
import { evaluate, generateProblem, matchesTarget } from '../src/lib/engine.js';

let pass = 0;
let fail = 0;
function eq(name, tokens, expected) {
  const r = evaluate([...tokens]);
  const got = r.ok ? r.value : 'ERR';
  const ok = r.ok && Math.abs(r.value - expected) < 1e-9;
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL ${name}: ${tokens.join('')} => ${got} (expected ${expected})`);
  }
}
function invalid(name, tokens) {
  const r = evaluate([...tokens]);
  if (!r.ok) pass++;
  else {
    fail++;
    console.log(`FAIL ${name}: ${tokens.join('')} should be invalid but got ${r.value}`);
  }
}

// 基本
eq('add', ['1', '+', '2'], 3);
eq('sub', ['9', '-', '4'], 5);
eq('mul', ['3', '*', '4'], 12);
eq('div', ['8', '/', '2'], 4);
eq('precedence', ['2', '+', '3', '*', '4'], 14);
eq('paren', ['(', '2', '+', '3', ')', '*', '4'], 20);
eq('pow', ['2', '^', '3'], 8);
eq('pow-right-assoc', ['2', '^', '3', '^', '2'], 512);
eq('factorial', ['5', '!'], 120);
eq('factorial-in-expr', ['3', '!', '+', '1'], 7);
eq('unary-minus', ['0', '-', '3'], -3);
eq('neg-pow', ['-', '3', '^', '2'], -9);

// ルール: 2桁以上は作れない（数字の連結は不正）
invalid('no-concat', ['1', '0']);
invalid('no-implicit-mul', ['2', '(', '3', ')']);
invalid('trailing-op', ['1', '+']);
invalid('empty', []);
invalid('div-zero', ['1', '/', '0']);
invalid('unbalanced', ['(', '1', '+', '2']);

// ジェネレータ: 生成した式は必ず題に一致し、各レベルの難易度要件を満たす
const LEVEL_REQ = {
  1: { min: 1, max: 20, advanced: false, paren: false },
  2: { min: 1, max: 50, advanced: false, paren: false },
  3: { min: 80, max: 800, advanced: true, paren: true }, // Expert
};
let genFail = 0;
for (const level of [1, 2, 3]) {
  const req = LEVEL_REQ[level];
  let fallbacks = 0;
  for (let i = 0; i < 500; i++) {
    const p = generateProblem(level);
    const r = evaluate([...p.answer]);
    if (!r.ok || !matchesTarget(r.value, p.target)) {
      genFail++;
      console.log(`FAIL gen L${level}: ${p.answer.join('')} != target ${p.target}`);
      break;
    }
    if (p.target < req.min || p.target > req.max) {
      genFail++;
      console.log(`FAIL gen L${level}: target ${p.target} outside [${req.min}, ${req.max}]`);
      break;
    }
    // パーツ各1個制約
    const counts = {};
    for (const t of p.answer) counts[t] = (counts[t] || 0) + 1;
    const dup = Object.entries(counts).find(([, c]) => c > 1);
    if (dup) {
      genFail++;
      console.log(`FAIL gen L${level}: part '${dup[0]}' used ${dup[1]}x in ${p.answer.join('')}`);
      break;
    }
    // 難易度要件
    if (req.advanced && !p.answer.includes('^') && !p.answer.includes('!')) {
      genFail++;
      console.log(`FAIL gen L${level}: missing advanced op (^ or !) in ${p.answer.join('')}`);
      break;
    }
    if (req.paren && !p.answer.includes('(')) {
      genFail++;
      console.log(`FAIL gen L${level}: missing paren in ${p.answer.join('')}`);
      break;
    }
    // フォールバックに頼っていないか（固定答えの target と完全一致が多すぎないかの目安）
    if (level === 3 && p.answer.join('') === '(1+4)^3-9*2') {
      fallbacks++;
    }
  }
  if (fallbacks > 5) {
    genFail++;
    console.log(`FAIL gen L${level}: too many fallbacks (${fallbacks}/500) — generator not producing variety`);
  }
}
if (genFail === 0) pass++;
else fail += genFail;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
