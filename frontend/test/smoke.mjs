// Real-browser smoke test: serve dist via vite preview and drive the UI.
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { port: 4399 } });
const base = 'http://localhost:4399/';
const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

let failed = 0;
const check = (cond, name) => {
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name); }
};

async function tapPart(label) {
  await page.getByRole('button', { name: label, exact: true }).first().click();
}
async function targetNum() {
  const txt = await page
    .locator('section:has-text("Make this number")')
    .locator('.text-6xl, .text-7xl')
    .first()
    .innerText();
  return parseInt(txt, 10);
}
// Click "New" until the target satisfies pred (keeps tests deterministic vs RNG)
async function newUntil(pred) {
  let t = await targetNum();
  for (let i = 0; i < 80 && !pred(t); i++) {
    await page.getByRole('button', { name: /New/ }).click();
    await page.waitForTimeout(35);
    t = await targetNum();
  }
  return t;
}

await page.goto(base, { waitUntil: 'networkidle' });

// 1. Mounts and shows the Target pane
check(await page.locator('text=Make this number').first().isVisible(), 'mounts & shows Target pane');

// 2. Give up reveals a solution that equals the target
await page.getByRole('button', { name: /Give up/ }).click();
check(await page.locator('text=One solution').isVisible(), 'give up reveals a solution');
const answerText = await page.locator('text=One solution').locator('..').innerText();
check(/=\s*\d+/.test(answerText), 'solution shows "= target"');

// 3. Next resets the expression
await page.getByRole('button', { name: /Next/ }).click();
await page.waitForTimeout(150);
check(await page.locator('text=Drop parts here').isVisible(), 'next problem resets expression');

// 4. Tapping parts updates the result (1 + 2 = 3). Target >= 10 so this won't auto-solve.
await page.getByRole('button', { name: 'Easy', exact: true }).click();
await newUntil((t) => t >= 10);
await tapPart('1');
await tapPart('+');
await tapPart('2');
await page.waitForTimeout(100);
const resultPane = await page.locator('section:has-text("Result")').first().innerText();
check(/\b3\b/.test(resultPane), 'tapping 1 + 2 computes 3 in Result');

// 5. Adjacent digits are rejected (no multi-digit numbers). Still target >= 10, so no solve.
await page.getByRole('button', { name: /Clear all/ }).click();
await tapPart('1');
await tapPart('2'); // "1" "2" with no operator -> invalid
await page.waitForTimeout(100);
check(await page.locator('text=Invalid expression').isVisible(), 'adjacent digits are rejected (no 2-digit numbers)');

// 6. Solving does NOT auto-advance — you must press Next
await page.getByRole('button', { name: 'Easy', exact: true }).click();
const t = await newUntil((x) => x >= 1 && x <= 9); // single-digit target solvable by one digit
check(t >= 1 && t <= 9, `found single-digit target to solve (got ${t})`);
await tapPart(String(t)); // the digit alone == target -> solved
await page.waitForTimeout(120);
check(await page.locator('text=Solved! Correct').isVisible(), 'solving shows the Solved banner');
const before = await targetNum();
await page.waitForTimeout(1700);
const stillSolved = await page.locator('text=Solved! Correct').isVisible();
check(stillSolved && (await targetNum()) === before, 'does NOT auto-advance — waits for the button');
await page.getByRole('button', { name: /Next/ }).click();
await page.waitForTimeout(150);
check(
  !(await page.locator('text=Solved! Correct').isVisible()) &&
    (await page.locator('text=Drop parts here').isVisible()),
  'pressing Next advances and resets',
);

// 7. Expert is the top level and still generates a hard problem
await page.getByRole('button', { name: 'Expert', exact: true }).click();
await page.waitForTimeout(150);
const tnum = await targetNum();
check(Number.isFinite(tnum) && tnum >= 80, `expert generates a hard target (got ${tnum} >= 80)`);
// Expert solution must contain parentheses and an advanced op (^ or !)
await page.getByRole('button', { name: /Give up/ }).click();
const expertAnswer = await page.locator('text=One solution').locator('..').innerText();
check(
  expertAnswer.includes('(') && (expertAnswer.includes('^') || expertAnswer.includes('!')),
  `expert answer uses paren & advanced op: "${expertAnswer.replace(/\s+/g, ' ').trim()}"`,
);

// 8. Placed parts can be reordered by drag & drop
await page.getByRole('button', { name: 'Easy', exact: true }).click();
await newUntil((x) => x >= 10); // avoid single-digit accidental solve
await tapPart('1');
await tapPart('2');
await tapPart('3');
const exprBtns = page.locator('div[role="list"] > button');
check((await exprBtns.allInnerTexts()).join('') === '123', 'placed order is 1,2,3');
await exprBtns.nth(2).dragTo(exprBtns.nth(0)); // drag last "3" onto first "1" -> 3,1,2
await page.waitForTimeout(120);
const order2 = (await exprBtns.allInnerTexts()).join('');
check(order2 === '312', `drag reorder 1,2,3 -> 3,1,2 (got ${order2})`);

check(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

await browser.close();
await server.httpServer.close();
console.log(`\n${failed ? 'FAILED ' + failed : 'ALL SMOKE TESTS PASSED'}`);
process.exit(failed ? 1 : 0);
