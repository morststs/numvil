// 出題モードの「解いた履歴」をブラウザの localStorage に保存する。
// 1問解くごとに、レベル・問題番号・題（target）・使った数式・解いた時刻を記録する。
// 同じ問題を解き直した場合は最新の数式で上書きする。

const STORAGE_KEY = 'numvil.challenge.history.v1';

// SSR / localStorage 不可環境でも落ちないようにガードする。
function safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function keyOf(level, index) {
  return `${level}-${index}`;
}

// 履歴全体を { "level-index": record } の形で返す。
export function loadHistory() {
  const ls = safeStorage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function persist(history) {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // 容量超過などは黙って無視（履歴はベストエフォート）
  }
}

// 1問の解答を履歴に記録して、更新後の履歴を返す。
// expr は使ったトークン列の文字列（例: "(6+2)*4"）。
export function recordSolve(history, { level, index, target, expr }) {
  const next = { ...history };
  next[keyOf(level, index)] = {
    level,
    index,
    target,
    expr,
    solvedAt: new Date().toISOString(),
  };
  persist(next);
  return next;
}

export function isSolved(history, level, index) {
  return Boolean(history[keyOf(level, index)]);
}

export function getSolve(history, level, index) {
  return history[keyOf(level, index)] || null;
}

// あるレベルで解いた問題数。
export function solvedCountForLevel(history, level) {
  return Object.values(history).filter((r) => r.level === level).length;
}

// 履歴を新しい順（解いた時刻の降順）の配列で返す。
export function historyList(history) {
  return Object.values(history).sort((a, b) =>
    (b.solvedAt || '').localeCompare(a.solvedAt || '')
  );
}

// 全履歴を消去する。
export function clearHistory() {
  const ls = safeStorage();
  if (ls) {
    try { ls.removeItem(STORAGE_KEY); } catch {}
  }
  return {};
}
