<script>
  import { Badge } from 'flowbite-svelte';
  import {
    DIGIT_PARTS,
    OP_PARTS,
    evaluate,
    matchesTarget,
    generateProblem,
  } from './lib/engine.js';
  import {
    CHALLENGE_PROBLEMS,
    CHALLENGE_LEVELS,
    PROBLEMS_PER_LEVEL,
  } from './lib/problems.js';
  import {
    loadHistory,
    recordSolve,
    getSolve,
    solvedCountForLevel,
    historyList,
    clearHistory,
  } from './lib/storage.js';

  // Display mapping for operator symbols (internal tokens stay as raw chars)
  const DISP = {
    '*': '×', '/': '÷', '-': '−', '^': '^', '!': '!',
    '+': '+', '(': '(', ')': ')',
  };
  const disp = (ch) => DISP[ch] ?? ch;
  const dispExpr = (s) => [...s].map(disp).join('');

  // Endless mode levels (free generated problems)
  const LEVELS = [
    { value: 1, label: 'Easy' },
    { value: 2, label: 'Normal' },
    { value: 3, label: 'Expert' },
  ];

  // 'endless' = original free-play; 'challenge' = fixed 5×10 problem set
  let mode = $state('endless');

  // Endless mode state
  let level = $state(1);

  // Challenge mode state (出題モード)
  let chLevel = $state(1); // 1..5
  let chIndex = $state(0); // 0..9
  let history = $state(loadHistory()); // solved records from localStorage
  let showHistory = $state(false);

  let problem = $state(generateProblem(1)); // { target, answer? }
  let placed = $state([]); // [{ id, ch }]
  let revealed = $state(false); // showing the answer after Give up (endless only)
  let solved = $state(false); // cleared (waiting for Next)
  let solvedCount = $state(0); // endless session counter
  let dropActive = $state(false);
  let dragOverId = $state(null); // highlight the insertion target while reordering
  let dragSource = $state(null); // { type:'palette', ch } | { type:'placed', id }
  let dragging = $state(false);  // press has crossed the drag threshold
  let ghost = $state(null);      // { ch, x, y } floating preview during a drag
  let startX = 0, startY = 0, activePointer = null;
  let uid = 0;

  // Derived state (for display)
  let usedSet = $derived(new Set(placed.map((p) => p.ch)));
  let result = $derived(evaluate(placed.map((p) => p.ch)));
  let cleared = $derived(result.ok && matchesTarget(result.value, problem.target));

  // Challenge-mode derived helpers
  let chProblems = $derived(CHALLENGE_PROBLEMS[chLevel] ?? []);
  let chSolvedCount = $derived(solvedCountForLevel(history, chLevel));
  let chLevelComplete = $derived(chSolvedCount >= PROBLEMS_PER_LEVEL);
  let priorSolve = $derived(
    mode === 'challenge' ? getSolve(history, chLevel, chIndex) : null
  );
  let recentHistory = $derived(historyList(history));

  // When the expression matches the target, mark solved (no auto-advance; user presses Next)
  function checkSolved(tokens) {
    if (solved || revealed) return;
    const r = evaluate(tokens.map((p) => p.ch));
    if (r.ok && matchesTarget(r.value, problem.target)) {
      solved = true;
      if (mode === 'endless') {
        solvedCount += 1;
      } else {
        // 出題モード：解いた問題・数式・時刻をローカルストレージに保存
        history = recordSolve(history, {
          level: chLevel,
          index: chIndex,
          target: problem.target,
          expr: tokens.map((p) => p.ch).join(''),
        });
      }
    }
  }

  // Load the current problem for the active mode and reset the board.
  function loadProblem() {
    if (mode === 'endless') {
      problem = generateProblem(level);
    } else {
      const p = chProblems[chIndex];
      // 出題モードでは答えは見せない（answer は持たせない）
      problem = { target: p ? p.target : 0, level: chLevel };
    }
    placed = [];
    revealed = false;
    solved = false;
  }

  function addPart(ch) {
    if (solved || revealed) return;
    if (usedSet.has(ch)) return; // each part can be used once per expression
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
    loadProblem();
  }

  function surrender() {
    if (solved || mode !== 'endless') return; // 出題モードは答えを見られない
    revealed = true;
    // Show the solution inside the expression pane
    placed = problem.answer.map((ch) => ({ id: uid++, ch }));
  }

  function changeLevel(v) {
    level = v;
    loadProblem();
  }

  // --- Challenge mode (出題モード) navigation ---
  function setMode(m) {
    if (mode === m) return;
    mode = m;
    showHistory = false;
    loadProblem();
  }

  function changeChallengeLevel(l) {
    chLevel = l;
    chIndex = 0;
    loadProblem();
  }

  function selectChallengeProblem(i) {
    chIndex = i;
    loadProblem();
  }

  function nextChallenge() {
    if (chIndex < PROBLEMS_PER_LEVEL - 1) {
      chIndex += 1;
    }
    loadProblem();
  }

  function clearAllHistory() {
    history = clearHistory();
  }

  // --- Unified pointer drag & drop (mouse + touch) with tap fallback ---
  // A press that moves past a small threshold = drag (reorder / insert).
  // A plain press = tap (palette: add to end, placed: remove). HTML5 DnD is
  // avoided because dragstart/drop never fire on touch devices.
  const DRAG_THRESHOLD = 8; // px before a press becomes a drag

  function placedChar(id) {
    const p = placed.find((x) => x.id === id);
    return p ? p.ch : '';
  }

  function partPointerDown(e, source) {
    if (solved || revealed) return;
    if (source.type === 'palette' && usedSet.has(source.ch)) return;
    dragSource = source;
    dragging = false;
    startX = e.clientX;
    startY = e.clientY;
    activePointer = e.pointerId;
    dragOverId = null;
    dropActive = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }

  // Which placed token / drop zone is under the pointer? The ghost has
  // pointer-events:none so it never hit-tests itself.
  function locateTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return { inZone: false, tokenId: null };
    const tok = el.closest('[data-token-id]');
    if (tok) return { inZone: true, tokenId: Number(tok.getAttribute('data-token-id')) };
    return { inZone: !!el.closest('[data-drop-zone]'), tokenId: null };
  }

  function partPointerMove(e) {
    if (!dragSource || e.pointerId !== activePointer) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
      dragging = true;
    }
    e.preventDefault();
    const ch = dragSource.type === 'palette' ? dragSource.ch : placedChar(dragSource.id);
    ghost = { ch, x: e.clientX, y: e.clientY };
    const { inZone, tokenId } = locateTarget(e.clientX, e.clientY);
    dropActive = inZone;
    dragOverId = tokenId;
  }

  function partPointerUp(e) {
    if (!dragSource || e.pointerId !== activePointer) return;
    if (dragging) {
      const { inZone, tokenId } = locateTarget(e.clientX, e.clientY);
      const ontoSelf = dragSource.type === 'placed' && tokenId === dragSource.id;
      if (!ontoSelf && (inZone || tokenId != null)) commitDrop(tokenId);
    } else if (dragSource.type === 'palette') {
      addPart(dragSource.ch); // tap = add to end
    } else {
      removeAt(dragSource.id); // tap = remove
    }
    endDrag();
  }

  function partKeyDown(e, source) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (solved || revealed) return;
    e.preventDefault();
    if (source.type === 'palette') addPart(source.ch);
    else removeAt(source.id);
  }

  function endDrag() {
    dragSource = null;
    dragging = false;
    ghost = null;
    dragOverId = null;
    dropActive = false;
    activePointer = null;
  }

  // Build a new array with the source inserted/moved before targetId (null = end)
  function buildDrop(targetId) {
    if (!dragSource) return null;
    const arr = placed.slice();
    if (dragSource.type === 'palette') {
      if (usedSet.has(dragSource.ch)) return null;
      const at = targetId == null ? arr.length : arr.findIndex((p) => p.id === targetId);
      arr.splice(at < 0 ? arr.length : at, 0, { id: uid++, ch: dragSource.ch });
    } else {
      const from = arr.findIndex((p) => p.id === dragSource.id);
      if (from < 0) return null;
      const [item] = arr.splice(from, 1);
      let at = targetId == null ? arr.length : arr.findIndex((p) => p.id === targetId);
      if (at < 0) at = arr.length;
      arr.splice(at, 0, item);
    }
    return arr;
  }

  function commitDrop(targetId) {
    if (solved || revealed) return;
    const arr = buildDrop(targetId);
    dragOverId = null;
    dropActive = false;
    if (arr) {
      placed = arr;
      checkSolved(arr);
    }
  }

  function fmt(v) {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1000) / 1000);
  }
</script>

<div class="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-5 text-slate-100 sm:p-8 lg:p-12">
  <div class="mx-auto flex max-w-3xl flex-col gap-4 sm:gap-5">

    <!-- Header -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="font-game bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
        Numvil
      </h1>
      <!-- Mode toggle: Endless (free play) vs Challenge (fixed problem set) -->
      <div class="flex gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
        {#each [{ value: 'endless', label: 'Endless' }, { value: 'challenge', label: 'Challenge' }] as m}
          <button
            class="rounded-full px-4 py-1.5 text-sm font-bold whitespace-nowrap transition
              {mode === m.value
                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/40'
                : 'text-slate-300 hover:bg-white/10'}"
            onclick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        {/each}
      </div>
    </header>

    <!-- Mode-specific controls -->
    {#if mode === 'endless'}
      <div class="flex flex-wrap items-center justify-end gap-2">
        <span class="rounded-full bg-white/5 px-4 py-1.5 text-sm font-bold text-cyan-300 ring-1 ring-white/10">
          Solved {solvedCount}
        </span>
        <div class="flex gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
          {#each LEVELS as lv}
            <button
              class="rounded-full px-4 py-1.5 text-sm font-bold whitespace-nowrap transition
                {level === lv.value
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-300 hover:bg-white/10'}"
              onclick={() => changeLevel(lv.value)}
            >
              {lv.label}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <section class="rounded-3xl bg-white/5 p-4 shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl">
        <!-- Level 1..5 selector -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Level</span>
          <span class="text-xs font-bold text-cyan-300">{chSolvedCount} / {PROBLEMS_PER_LEVEL} solved</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          {#each Array(CHALLENGE_LEVELS) as _, i}
            {@const lv = i + 1}
            {@const lvSolved = solvedCountForLevel(history, lv)}
            {@const lvComplete = lvSolved >= PROBLEMS_PER_LEVEL}
            <button
              class="relative flex flex-1 flex-col items-center rounded-xl px-3 py-1.5 leading-tight whitespace-nowrap transition
                {chLevel === lv
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/40'
                  : lvComplete
                    ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-300/40 hover:bg-emerald-500/30'
                    : lvSolved > 0
                      ? 'bg-white/5 text-slate-200 ring-1 ring-cyan-300/30 hover:bg-white/10'
                      : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'}"
              onclick={() => changeChallengeLevel(lv)}
              title={lvComplete
                ? `Level ${lv} complete (${lvSolved}/${PROBLEMS_PER_LEVEL})`
                : `Level ${lv} — ${lvSolved}/${PROBLEMS_PER_LEVEL} solved`}
            >
              <span class="text-sm font-bold">{lv}</span>
              <span class="text-[10px] font-bold tabular-nums
                {chLevel === lv ? 'text-white/80' : lvComplete ? 'text-emerald-300/90' : 'text-slate-400'}">
                {lvSolved}/{PROBLEMS_PER_LEVEL}
              </span>
              {#if lvComplete}<span class="absolute -right-1 -top-1 text-xs">🏆</span>{/if}
            </button>
          {/each}
        </div>

        <!-- Problem 1..10 navigation (✓ = solved) -->
        <div class="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
          {#each chProblems as _, i}
            {@const done = !!getSolve(history, chLevel, i)}
            <button
              class="relative flex h-10 items-center justify-center rounded-xl text-sm font-bold transition
                {chIndex === i
                  ? 'bg-gradient-to-br from-cyan-500 to-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                  : done
                    ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-300/40 hover:bg-emerald-500/30'
                    : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'}"
              onclick={() => selectChallengeProblem(i)}
              title={done ? `Solved: ${dispExpr(getSolve(history, chLevel, i).expr)}` : `Problem ${i + 1}`}
            >
              {i + 1}{#if done}<span class="absolute -right-0.5 -top-0.5 text-xs text-emerald-300">✓</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Target -->
    <section class="rounded-3xl bg-white/5 p-6 text-center shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl">
      <div class="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/70">
        {#if mode === 'challenge'}
          Lv {chLevel} · Problem {chIndex + 1} / {PROBLEMS_PER_LEVEL}
        {:else}
          Make this number
        {/if}
      </div>
      <div class="font-game mt-2 bg-gradient-to-br from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-6xl font-bold text-transparent sm:text-7xl">
        {problem.target}
      </div>
      {#if mode === 'challenge' && priorSolve && !solved}
        <div class="mt-2 text-xs font-bold text-emerald-300/80">
          ✓ Already solved · {dispExpr(priorSolve.expr)}
        </div>
      {/if}
    </section>

    <!-- Result -->
    <section class="rounded-3xl p-5 text-center shadow-xl shadow-black/30 ring-1 backdrop-blur-xl transition
      {cleared ? 'bg-emerald-400/10 ring-emerald-300/40' : 'bg-white/5 ring-white/10'}">
      <div class="text-xs font-bold uppercase tracking-[0.3em] {cleared ? 'text-emerald-300' : 'text-slate-400'}">Result</div>
      {#if placed.length === 0}
        <div class="font-game mt-1 text-4xl font-bold text-slate-600">—</div>
      {:else if result.ok}
        <div class="font-game mt-1 text-5xl font-bold {cleared ? 'text-emerald-300' : 'text-cyan-200'}">
          {fmt(result.value)}
        </div>
        {#if cleared}
          <div class="animate-cheer mt-1 text-xl font-bold text-emerald-300">🎉 Solved!</div>
        {/if}
      {:else}
        <div class="font-game mt-1 text-2xl font-bold text-rose-300/80">Invalid expression</div>
      {/if}
    </section>

    <!-- Expression (drop target) -->
    <section class="rounded-3xl bg-white/5 p-5 shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl">
      <div class="mb-3 flex items-center justify-between gap-2">
        <span class="min-w-0 truncate text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/70">Expression — drag to reorder</span>
        <button
          class="shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold text-indigo-300 transition hover:bg-white/10 disabled:opacity-30"
          onclick={clearExpr}
          disabled={placed.length === 0 || revealed || solved}
        >
          Clear all
        </button>
      </div>

      <div
        role="list"
        data-drop-zone
        class="flex min-h-[72px] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-black/20 p-3 {dropActive ? 'drop-active' : ''}"
      >
        {#if placed.length === 0}
          <span class="select-none px-2 text-slate-500">Drop parts here / tap to add</span>
        {/if}
        {#each placed as p (p.id)}
          <button
            data-token-id={p.id}
            style="touch-action:none"
            class="part-btn animate-pop font-game flex h-12 min-w-[2.75rem] items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 px-2 text-2xl font-bold text-white shadow-lg shadow-indigo-900/40 hover:brightness-110
              {!solved && !revealed ? 'cursor-grab active:cursor-grabbing' : ''}
              {dragging && dragSource?.type === 'placed' && dragSource.id === p.id ? 'opacity-40' : ''}
              {dragOverId === p.id ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-900' : ''}"
            onpointerdown={(e) => partPointerDown(e, { type: 'placed', id: p.id })}
            onpointermove={partPointerMove}
            onpointerup={partPointerUp}
            onpointercancel={endDrag}
            onkeydown={(e) => partKeyDown(e, { type: 'placed', id: p.id })}
            title="Drag to reorder / tap to remove"
          >
            {disp(p.ch)}
          </button>
        {/each}
      </div>
    </section>

    <!-- Solved: no auto-advance, press Next -->
    {#if solved}
      <section class="animate-cheer rounded-3xl bg-emerald-400/10 p-5 text-center shadow-xl shadow-black/30 ring-1 ring-emerald-300/40 backdrop-blur-xl">
        <div class="text-2xl font-bold text-emerald-300">🎉 Solved! Correct!</div>
        {#if mode === 'challenge'}
          {#if chLevelComplete && chIndex === PROBLEMS_PER_LEVEL - 1}
            <div class="mt-1 text-sm font-bold text-cyan-200">Level {chLevel} complete! 🏆</div>
          {/if}
          {#if chIndex < PROBLEMS_PER_LEVEL - 1}
            <button
              class="mt-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-2.5 font-bold text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110"
              onclick={nextChallenge}
            >
              Next ▶
            </button>
          {/if}
        {:else}
          <button
            class="mt-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-2.5 font-bold text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110"
            onclick={nextProblem}
          >
            Next ▶
          </button>
        {/if}
      </section>
    {/if}

    <!-- Give up: show a solution -->
    {#if revealed}
      <section class="animate-pop rounded-3xl bg-rose-400/10 p-5 text-center shadow-xl shadow-black/30 ring-1 ring-rose-300/30 backdrop-blur-xl">
        <div class="text-xs font-bold uppercase tracking-[0.2em] text-rose-300/80">One solution</div>
        <div class="font-game mt-2 text-3xl font-bold text-rose-200">
          {problem.answer.map(disp).join(' ')} = {problem.target}
        </div>
        <button
          class="mt-3 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 py-2.5 font-bold text-white shadow-lg shadow-fuchsia-900/40 transition hover:brightness-110"
          onclick={nextProblem}
        >
          Next ▶
        </button>
      </section>
    {/if}

    <!-- Parts -->
    <section class="rounded-3xl bg-white/5 p-5 shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl">
      <div class="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/70">Parts</div>

      <div class="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {#each DIGIT_PARTS as ch}
          {@const used = usedSet.has(ch)}
          <button
            style="touch-action:none"
            class="part-btn font-game flex h-12 items-center justify-center rounded-xl text-2xl font-bold transition
              {used
                ? 'cursor-not-allowed bg-white/5 text-slate-600 ring-1 ring-white/10'
                : 'bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-lg shadow-cyan-900/40 hover:brightness-110'}"
            onpointerdown={(e) => partPointerDown(e, { type: 'palette', ch })}
            onpointermove={partPointerMove}
            onpointerup={partPointerUp}
            onpointercancel={endDrag}
            onkeydown={(e) => partKeyDown(e, { type: 'palette', ch })}
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
            style="touch-action:none"
            class="part-btn font-game flex h-12 items-center justify-center rounded-xl text-2xl font-bold transition
              {used
                ? 'cursor-not-allowed bg-white/5 text-slate-600 ring-1 ring-white/10'
                : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/40 hover:brightness-110'}"
            onpointerdown={(e) => partPointerDown(e, { type: 'palette', ch })}
            onpointermove={partPointerMove}
            onpointerup={partPointerUp}
            onpointercancel={endDrag}
            onkeydown={(e) => partKeyDown(e, { type: 'palette', ch })}
            disabled={used || solved || revealed}
          >
            {disp(ch)}
          </button>
        {/each}
      </div>
    </section>

    <!-- Actions -->
    {#if mode === 'endless'}
      <div class="flex items-center justify-center gap-3 pb-2">
        <button
          class="rounded-full bg-white/5 px-8 py-2.5 font-bold text-slate-200 ring-1 ring-white/15 transition hover:bg-white/10 disabled:opacity-30"
          onclick={surrender}
          disabled={solved || revealed}
        >
          🏳️ Give up
        </button>
        <button
          class="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-8 py-2.5 font-bold text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110"
          onclick={nextProblem}
        >
          🔄 New
        </button>
      </div>
    {:else}
      <!-- Challenge mode: no answer reveal; navigate problems or review history -->
      <div class="flex items-center justify-center gap-3 pb-2">
        <button
          class="rounded-full bg-white/5 px-8 py-2.5 font-bold text-slate-200 ring-1 ring-white/15 transition hover:bg-white/10"
          onclick={() => (showHistory = !showHistory)}
        >
          📜 History {showHistory ? '▲' : '▼'}
        </button>
      </div>

      {#if showHistory}
        <section class="rounded-3xl bg-white/5 p-5 shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl">
          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">Solved history</span>
            <button
              class="shrink-0 rounded-full px-4 py-1.5 text-sm font-bold text-rose-300 transition hover:bg-white/10 disabled:opacity-30"
              onclick={clearAllHistory}
              disabled={recentHistory.length === 0}
            >
              Clear history
            </button>
          </div>
          {#if recentHistory.length === 0}
            <div class="px-2 py-6 text-center text-sm text-slate-500">No solved problems yet.</div>
          {:else}
            <ul class="flex flex-col gap-1.5">
              {#each recentHistory as h}
                <li class="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/5">
                  <span class="shrink-0 text-xs font-bold text-violet-300">Lv {h.level}·{h.index + 1}</span>
                  <span class="font-game min-w-0 flex-1 truncate text-cyan-200" title="{dispExpr(h.expr)} = {h.target}">
                    {dispExpr(h.expr)} = {h.target}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
    {/if}

    <footer class="pb-2 text-center text-xs text-slate-400">
      <Badge color="indigo" class="mr-1">Rules</Badge>
      Each part once per expression · you can't join digits into multi-digit numbers
    </footer>
  </div>

  <!-- Floating preview that follows the pointer/finger while dragging -->
  {#if ghost}
    <div
      class="font-game pointer-events-none fixed z-50 flex h-12 min-w-[2.75rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 px-2 text-2xl font-bold text-white opacity-90 shadow-xl shadow-black/50"
      style="left:{ghost.x}px; top:{ghost.y}px"
    >
      {disp(ghost.ch)}
    </div>
  {/if}
</div>
