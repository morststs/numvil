// 出題モードの固定問題集テスト: node frontend/test/challenge.test.mjs
// problems.js の各問題が「5レベル×10問・整数の題」であること、および
// コメントに残した「解答例」が実際にその題へ評価されること（＝解が必ず存在する）を検証する。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evaluate, matchesTarget } from '../src/lib/engine.js';
import {
  CHALLENGE_PROBLEMS,
  CHALLENGE_LEVELS,
  PROBLEMS_PER_LEVEL,
} from '../src/lib/problems.js';

let pass = 0;
let fail = 0;
function check(cond, msg) {
  if (cond) pass++;
  else { fail++; console.log('FAIL ' + msg); }
}

// 構造：5レベル × 各10問、題は正の整数
for (let level = 1; level <= CHALLENGE_LEVELS; level++) {
  const list = CHALLENGE_PROBLEMS[level];
  check(Array.isArray(list) && list.length === PROBLEMS_PER_LEVEL,
    `L${level} should have ${PROBLEMS_PER_LEVEL} problems`);
  for (const p of list || []) {
    check(Number.isInteger(p.target) && p.target > 0,
      `L${level} target must be a positive integer (got ${p.target})`);
  }
}

// 解答例（ソースコメント）が題に一致すること＝各問に有効な解が存在する
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/lib/problems.js'), 'utf8');
// 例: "{ target: 32 }, // 解答例: (6+2)*4 = 32"
const re = /target:\s*(\d+)\s*}\s*,\s*\/\/\s*解答例:\s*([0-9()!+\-/*^]+)\s*=\s*(\d+)/g;
let count = 0;
let m;
while ((m = re.exec(src)) !== null) {
  count++;
  const target = Number(m[1]);
  const expr = m[2];
  const stated = Number(m[3]);
  const tokens = [...expr]; // 各文字が1トークン
  const r = evaluate(tokens);
  check(r.ok, `解答例 ${expr} should evaluate (L?/${target})`);
  check(r.ok && matchesTarget(r.value, target),
    `解答例 ${expr} should equal target ${target} (got ${r.ok ? r.value : 'ERR'})`);
  check(stated === target, `解答例 comment "= ${stated}" should match target ${target}`);
  // 各1個制約（解答例も制約を守っているか）
  const counts = {};
  for (const t of tokens) counts[t] = (counts[t] || 0) + 1;
  const dup = Object.entries(counts).find(([, c]) => c > 1);
  check(!dup, `解答例 ${expr} reuses part '${dup ? dup[0] : ''}'`);
}
check(count === CHALLENGE_LEVELS * PROBLEMS_PER_LEVEL,
  `should find ${CHALLENGE_LEVELS * PROBLEMS_PER_LEVEL} 解答例 comments (found ${count})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
