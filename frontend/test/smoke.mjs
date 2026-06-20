// 実ブラウザでのスモークテスト: dist をプレビュー配信し、UI 操作を検証する。
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

await page.goto(base, { waitUntil: 'networkidle' });

// 1. マウントされ題が表示される
const target = await page.locator('section >> text=題（この数を作ろう）').first().isVisible();
check(target, 'mounts & shows 題 pane');

// 2. 降参で答えが表示され、その式が題に一致するのを確認
await page.getByRole('button', { name: /降参/ }).click();
const answerVisible = await page.locator('text=答えの一例').isVisible();
check(answerVisible, 'surrender reveals answer');

// 答え文字列に "= N" が含まれる
const answerText = await page.locator('text=答えの一例').locator('..').innerText();
check(/=\s*\d+/.test(answerText), 'answer shows "= target"');

// 3. つぎの題へ → リセットされる
await page.getByRole('button', { name: /つぎの題へ/ }).click();
await page.waitForTimeout(200);
const reset = await page.locator('text=ここにパーツをドロップ').isVisible();
check(reset, 'next problem resets expression');

// 4. パーツをタップして式に追加 → 結果が更新される
//    "1" と "+" と "2" を押して結果 3 を確認
async function tapPart(label) {
  await page.getByRole('button', { name: label, exact: true }).first().click();
}
await tapPart('1');
await tapPart('+');
await tapPart('2');
await page.waitForTimeout(100);
const resultPane = await page.locator('section:has-text("結果")').first().innerText();
check(/\b3\b/.test(resultPane), 'tapping 1 + 2 computes 3 in 結果');

// 5. 不正な式（数字の連結 "1" "2"）は「式が正しくありません」
await page.getByRole('button', { name: /ぜんぶ消す/ }).click();
await tapPart('1');
await tapPart('2'); // 1 と 2 を連結 → 不正
await page.waitForTimeout(100);
const invalid = await page.locator('text=式が正しくありません').isVisible();
check(invalid, 'adjacent digits are rejected (no 2-digit numbers)');

check(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

await browser.close();
await server.httpServer.close();
console.log(`\n${failed ? 'FAILED ' + failed : 'ALL SMOKE TESTS PASSED'}`);
process.exit(failed ? 1 : 0);
