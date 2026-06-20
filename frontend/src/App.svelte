<script>
  import { Button, Badge } from 'flowbite-svelte';
  import {
    DIGIT_PARTS,
    OP_PARTS,
    evaluate,
    matchesTarget,
    generateProblem,
  } from './lib/engine.js';

  // 記号の表示用マッピング（内部のトークンは元の文字のまま）
  const DISP = {
    '*': '×', '/': '÷', '-': '−', '^': '^', '!': '!',
    '+': '+', '(': '(', ')': ')',
  };
  const disp = (ch) => DISP[ch] ?? ch;

  const LEVELS = [
    { value: 1, label: 'やさしい' },
    { value: 2, label: 'ふつう' },
    { value: 3, label: 'むずかしい' },
  ];

  let level = $state(1);
  let problem = $state(generateProblem(1));
  let placed = $state([]); // [{ id, ch }]
  let revealed = $state(false); // 降参で答えを表示中
  let solved = $state(false); // クリア済み（演出中）
  let solvedCount = $state(0);
  let dropActive = $state(false);
  let uid = 0;
  let solveTimer = null;

  // 派生状態（表示用）
  let usedSet = $derived(new Set(placed.map((p) => p.ch)));
  let result = $derived(evaluate(placed.map((p) => p.ch)));
  let cleared = $derived(result.ok && matchesTarget(result.value, problem.target));

  // 式が題に一致したら演出 → 自動で次の題へ（イミュータブルに判定し副作用ループを避ける）
  function checkSolved(tokens) {
    if (solved || revealed) return;
    const r = evaluate(tokens.map((p) => p.ch));
    if (r.ok && matchesTarget(r.value, problem.target)) {
      solved = true;
      solvedCount += 1;
      clearTimeout(solveTimer);
      solveTimer = setTimeout(() => nextProblem(), 1500);
    }
  }

  function addPart(ch) {
    if (solved || revealed) return;
    if (usedSet.has(ch)) return; // 各パーツは1式に1回まで
    const next = [...placed, { id: uid++, ch }];
    placed = next;
    checkSolved(next);
  }

  function removeAt(id) {
    if (solved || revealed) return;
    placed = placed.filter((p) => p.id !== id);
  }

  function clearExpr() {
    if (revealed || solved) return;
    placed = [];
  }

  function nextProblem() {
    clearTimeout(solveTimer);
    problem = generateProblem(level);
    placed = [];
    revealed = false;
    solved = false;
  }

  function surrender() {
    if (solved) return;
    revealed = true;
    // 答えの式を「式」ペインに反映して見せる
    placed = problem.answer.map((ch) => ({ id: uid++, ch }));
  }

  function changeLevel(v) {
    level = v;
    nextProblem();
  }

  // ドラッグ&ドロップ（デスクトップ）／タップ（モバイル）両対応
  function onDragStart(e, ch) {
    if (usedSet.has(ch)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', ch);
    e.dataTransfer.effectAllowed = 'copy';
  }
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropActive = true;
  }
  function onDragLeave() {
    dropActive = false;
  }
  function onDrop(e) {
    e.preventDefault();
    dropActive = false;
    const ch = e.dataTransfer.getData('text/plain');
    if (ch) addPart(ch);
  }

  function fmt(v) {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1000) / 1000);
  }
</script>

<div class="min-h-screen w-full bg-gradient-to-br from-violet-100 via-sky-100 to-emerald-100 p-3 sm:p-5">
  <div class="mx-auto flex max-w-3xl flex-col gap-3 sm:gap-4">

    <!-- ヘッダー -->
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="font-game text-2xl font-bold text-violet-700 sm:text-3xl">🧮 Numvil</h1>
      <div class="flex items-center gap-2">
        <span class="rounded-full bg-white/70 px-3 py-1 text-sm font-bold text-emerald-600 shadow">
          クリア {solvedCount}
        </span>
        <div class="flex overflow-hidden rounded-full bg-white/70 shadow">
          {#each LEVELS as lv}
            <button
              class="px-3 py-1 text-sm font-bold transition
                {level === lv.value ? 'bg-violet-600 text-white' : 'text-violet-700 hover:bg-violet-100'}"
              onclick={() => changeLevel(lv.value)}
            >
              {lv.label}
            </button>
          {/each}
        </div>
      </div>
    </header>

    <!-- 題ペイン -->
    <section class="rounded-3xl bg-white/80 p-4 text-center shadow-lg ring-1 ring-violet-200 sm:p-6">
      <div class="text-sm font-bold tracking-widest text-violet-400">題（この数を作ろう）</div>
      <div class="font-game mt-1 text-6xl font-bold text-violet-700 sm:text-7xl">
        {problem.target}
      </div>
    </section>

    <!-- 式ペイン（ドロップ先） -->
    <section class="rounded-3xl bg-white/80 p-4 shadow-lg ring-1 ring-sky-200">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-bold tracking-widest text-sky-400">式（パーツを並べる）</span>
        <button
          class="rounded-full px-3 py-1 text-xs font-bold text-sky-600 hover:bg-sky-100 disabled:opacity-30"
          onclick={clearExpr}
          disabled={placed.length === 0 || revealed || solved}
        >
          ぜんぶ消す
        </button>
      </div>

      <div
        role="list"
        class="flex min-h-[68px] flex-wrap items-center gap-1.5 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-3 {dropActive ? 'drop-active' : ''}"
        ondragover={onDragOver}
        ondragleave={onDragLeave}
        ondrop={onDrop}
      >
        {#if placed.length === 0}
          <span class="select-none px-2 text-sky-300">ここにパーツをドロップ / タップで追加</span>
        {/if}
        {#each placed as p (p.id)}
          <button
            class="part-btn animate-pop font-game flex h-12 min-w-[2.75rem] items-center justify-center rounded-xl bg-sky-500 px-2 text-2xl font-bold text-white shadow hover:bg-sky-600"
            onclick={() => removeAt(p.id)}
            title="タップで取り除く"
          >
            {disp(p.ch)}
          </button>
        {/each}
      </div>
    </section>

    <!-- 結果ペイン -->
    <section class="rounded-3xl p-4 text-center shadow-lg ring-1 transition
      {cleared ? 'bg-emerald-100 ring-emerald-300' : 'bg-white/80 ring-amber-200'}">
      <div class="text-sm font-bold tracking-widest {cleared ? 'text-emerald-500' : 'text-amber-400'}">結果</div>
      {#if placed.length === 0}
        <div class="font-game mt-1 text-4xl font-bold text-gray-300">—</div>
      {:else if result.ok}
        <div class="font-game mt-1 text-5xl font-bold {cleared ? 'text-emerald-600' : 'text-amber-600'}">
          {fmt(result.value)}
        </div>
        {#if cleared}
          <div class="animate-cheer mt-1 text-xl font-bold text-emerald-600">🎉 クリア！</div>
        {/if}
      {:else}
        <div class="font-game mt-1 text-3xl font-bold text-rose-400">式が正しくありません</div>
      {/if}
    </section>

    <!-- 降参時の答え -->
    {#if revealed}
      <section class="animate-pop rounded-3xl bg-rose-50 p-4 text-center shadow ring-1 ring-rose-200">
        <div class="text-sm font-bold tracking-widest text-rose-400">答えの一例</div>
        <div class="font-game mt-1 text-3xl font-bold text-rose-600">
          {problem.answer.map(disp).join(' ')} = {problem.target}
        </div>
        <Button color="purple" class="mt-3 rounded-full" onclick={nextProblem}>つぎの題へ ▶</Button>
      </section>
    {/if}

    <!-- パーツペイン -->
    <section class="rounded-3xl bg-white/80 p-4 shadow-lg ring-1 ring-emerald-200">
      <div class="mb-2 text-sm font-bold tracking-widest text-emerald-400">パーツ</div>

      <div class="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {#each DIGIT_PARTS as ch}
          {@const used = usedSet.has(ch)}
          <button
            class="part-btn font-game flex h-12 items-center justify-center rounded-xl text-2xl font-bold shadow
              {used ? 'cursor-not-allowed bg-gray-200 text-gray-400 opacity-50'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'}"
            draggable={!used}
            ondragstart={(e) => onDragStart(e, ch)}
            onclick={() => addPart(ch)}
            disabled={used || solved || revealed}
          >
            {disp(ch)}
          </button>
        {/each}
      </div>

      <div class="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {#each OP_PARTS as ch}
          {@const used = usedSet.has(ch)}
          <button
            class="part-btn font-game flex h-12 items-center justify-center rounded-xl text-2xl font-bold shadow
              {used ? 'cursor-not-allowed bg-gray-200 text-gray-400 opacity-50'
                    : 'bg-orange-500 text-white hover:bg-orange-600'}"
            draggable={!used}
            ondragstart={(e) => onDragStart(e, ch)}
            onclick={() => addPart(ch)}
            disabled={used || solved || revealed}
          >
            {disp(ch)}
          </button>
        {/each}
      </div>
    </section>

    <!-- 操作 -->
    <div class="flex items-center justify-center gap-3 pb-4">
      <Button color="alternative" class="rounded-full" onclick={surrender} disabled={solved || revealed}>
        🏳️ 降参する
      </Button>
      <Button color="green" class="rounded-full" onclick={nextProblem}>
        🔄 次の題
      </Button>
    </div>

    <footer class="pb-4 text-center text-xs text-violet-400">
      <Badge color="purple" class="mr-1">ルール</Badge>
      パーツは各1個・1式に1回まで／数字を並べて2桁以上は作れません
    </footer>
  </div>
</div>
