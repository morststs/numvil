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

// ジェネレータ: 生成した式は必ず題に一致する
for (const level of [1, 2, 3]) {
  for (let i = 0; i < 300; i++) {
    const p = generateProblem(level);
    const r = evaluate([...p.answer]);
    if (!r.ok || !matchesTarget(r.value, p.target)) {
      fail++;
      console.log(`FAIL gen L${level}: ${p.answer.join('')} != target ${p.target}`);
      break;
    }
    if (p.target < 1) {
      fail++;
      console.log(`FAIL gen L${level}: target out of range ${p.target}`);
      break;
    }
    // パーツ各1個制約の検証
    const counts = {};
    for (const t of p.answer) counts[t] = (counts[t] || 0) + 1;
    for (const t in counts) {
      if (counts[t] > 1) {
        fail++;
        console.log(`FAIL gen L${level}: part '${t}' used ${counts[t]}x in ${p.answer.join('')}`);
        break;
      }
    }
  }
}
pass++; // generator loops completed

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
