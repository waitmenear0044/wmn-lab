/* =========================================================
   wmn-lab.ru — игры в окошках: Сапёр, Змейка, 2048, Крестики-нолики, Кирпичики
   Подгружается только когда посетитель открывает игру (меню «Игры»).
   Рекорды хранятся в браузере посетителя (localStorage).
   ========================================================= */
(function () {
  const REC_KEY = 'wmn-games';
  const records = () => { try { return JSON.parse(localStorage.getItem(REC_KEY)) || {}; } catch (e) { return {}; } };
  const saveRecord = (k, v) => { const r = records(); r[k] = v; try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) {} };
  const led = n => String(Math.max(-99, Math.min(999, n))).padStart(3, '0');
  const isTouch = matchMedia('(hover: none)').matches;

  // свайп по элементу → 'up' | 'down' | 'left' | 'right'
  function onSwipe(el, cb) {
    let sx = 0, sy = 0, id = null;
    el.addEventListener('pointerdown', e => { id = e.pointerId; sx = e.clientX; sy = e.clientY; });
    el.addEventListener('pointerup', e => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
  }
  const KEYDIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', 'ц': 'up', 'ы': 'down', 'ф': 'left', 'в': 'right' };

  /* =========================================================
     САПЁР
     ========================================================= */
  const LEVELS = {
    beg: { name: 'Новичок',      w: 9,  h: 9,  m: 10 },
    int: { name: 'Любитель',     w: 16, h: 16, m: 40 },
    exp: { name: 'Профессионал', w: 30, h: 16, m: 99 },
  };

  function mines() {
    WMN.window({
      id: 'mines', title: 'Сапёр', icon: '💣', width: 560,
      build(body) {
        let lvl = 'beg', L, cells, opened, flags, over, started, timer, time, flagMode = false;
        body.innerHTML = `
          <div class="g-toolbar">
            <div class="seg" data-lvl>${Object.entries(LEVELS).map(([k, v]) => `<button class="btn98" data-v="${k}" aria-pressed="${k === lvl}">${v.name}</button>`).join('')}</div>
            <button class="btn98 ms-flagmode" aria-pressed="false" title="Режим флажков для телефона">🚩</button>
          </div>
          <div class="ms-frame">
            <div class="ms-panel"><span class="ms-led" data-mines>000</span><button class="ms-face" aria-label="Новая игра">🙂</button><span class="ms-led" data-time>000</span></div>
            <div class="ms-scroll"><div class="ms-grid" role="grid"></div></div>
          </div>
          <p class="g-help">${isTouch ? 'Нажатие — открыть, долгое нажатие или режим 🚩 — флажок.' : 'Левый клик — открыть, правый — флажок, клик по цифре — открыть соседей.'}</p>
          <p class="g-rec" data-rec></p>`;
        const grid = body.querySelector('.ms-grid'), face = body.querySelector('.ms-face');
        const $mines = body.querySelector('[data-mines]'), $time = body.querySelector('[data-time]'), $rec = body.querySelector('[data-rec]');

        const nb = i => { const x = i % L.w, y = (i / L.w) | 0, r = [];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < L.w && ny < L.h) r.push(ny * L.w + nx); }
          return r; };

        function showRec() { const r = records()['mines-' + lvl]; $rec.textContent = r ? `Рекорд (${L.name}): ${r} с` : ''; }

        function reset() {
          L = LEVELS[lvl]; clearInterval(timer);
          cells = Array.from({ length: L.w * L.h }, () => ({ mine: false, n: 0, open: false, flag: false }));
          opened = 0; flags = 0; over = false; started = false; time = 0;
          face.textContent = '🙂'; $time.textContent = '000'; $mines.textContent = led(L.m);
          grid.style.setProperty('--cols', L.w);
          grid.innerHTML = cells.map((_, i) => `<button class="ms-c" data-i="${i}" aria-label="Клетка"></button>`).join('');
          showRec();
        }

        function plant(safe) {
          const ban = new Set([safe, ...nb(safe)]);
          let left = L.m;
          while (left) { const i = (Math.random() * cells.length) | 0; if (!cells[i].mine && !ban.has(i)) { cells[i].mine = true; left--; } }
          cells.forEach((c, i) => { c.n = nb(i).filter(j => cells[j].mine).length; });
          started = true;
          timer = setInterval(() => { time = Math.min(999, time + 1); $time.textContent = led(time); }, 1000);
        }

        const btn = i => grid.children[i];
        function draw(i) {
          const c = cells[i], b = btn(i);
          b.className = 'ms-c' + (c.open ? ' open n' + c.n : '') + (c.flag && !c.open ? ' flag' : '');
          b.textContent = c.open ? (c.mine ? '💣' : (c.n || '')) : (c.flag ? '🚩' : '');
        }

        function open(i) {
          const st = [i];
          while (st.length) {
            const k = st.pop(), c = cells[k];
            if (c.open || c.flag) continue;
            c.open = true; opened++; draw(k);
            if (c.mine) return lose(k);
            if (c.n === 0) nb(k).forEach(j => { if (!cells[j].open) st.push(j); });
          }
          if (opened === cells.length - L.m) win();
        }

        function lose(k) {
          over = true; clearInterval(timer); face.textContent = '😵';
          cells.forEach((c, i) => {
            if (c.mine && !c.flag) { c.open = true; draw(i); }
            if (!c.mine && c.flag) { btn(i).textContent = '❌'; }
          });
          btn(k).classList.add('boom');
        }

        function win() {
          over = true; clearInterval(timer); face.textContent = '😎';
          cells.forEach((c, i) => { if (c.mine && !c.flag) { c.flag = true; draw(i); } });
          $mines.textContent = '000';
          const key = 'mines-' + lvl, best = records()[key];
          const isRec = !best || time < best;
          if (isRec) saveRecord(key, time);
          showRec();
          WMN.dialog({ title: 'Победа!', icon: '😎', html: `<p>Все мины найдены за <b>${time} с</b>.</p>${isRec ? '<p>🏆 Это новый рекорд!</p>' : ''}` });
        }

        function toggleFlag(i) {
          const c = cells[i]; if (c.open || over) return;
          c.flag = !c.flag; flags += c.flag ? 1 : -1;
          $mines.textContent = led(L.m - flags); draw(i);
        }

        function act(i, flag) {
          if (over) return;
          const c = cells[i];
          if (flag) return toggleFlag(i);
          if (c.flag) return;
          if (!started) plant(i);
          if (c.open && c.n) {                               // «аккорд»: открыть соседей, если флажков хватает
            const around = nb(i);
            if (around.filter(j => cells[j].flag).length === c.n) around.forEach(j => { if (!cells[j].open && !cells[j].flag) open(j); });
            return;
          }
          open(i);
        }

        // мышь и палец
        let pressT = null, longDone = false;
        grid.addEventListener('contextmenu', e => { e.preventDefault(); const b = e.target.closest('.ms-c'); if (b && !isTouch) act(+b.dataset.i, true); });
        grid.addEventListener('pointerdown', e => {
          const b = e.target.closest('.ms-c'); if (!b || over) return;
          if (e.button === 0) face.textContent = '😮';
          longDone = false;
          if (e.pointerType !== 'mouse') pressT = setTimeout(() => { longDone = true; act(+b.dataset.i, true); navigator.vibrate && navigator.vibrate(30); }, 420);
        });
        grid.addEventListener('pointerup', e => {
          clearTimeout(pressT); if (!over) face.textContent = '🙂';
          const b = e.target.closest('.ms-c'); if (!b || e.button !== 0 || longDone) return;
          act(+b.dataset.i, flagMode);
        });
        grid.addEventListener('pointerleave', () => { clearTimeout(pressT); if (!over) face.textContent = '🙂'; });

        face.addEventListener('click', reset);
        body.querySelector('[data-lvl]').addEventListener('click', e => {
          const b = e.target.closest('[data-v]'); if (!b) return;
          lvl = b.dataset.v; body.querySelectorAll('[data-lvl] [data-v]').forEach(x => x.setAttribute('aria-pressed', x === b)); reset();
        });
        const fm = body.querySelector('.ms-flagmode');
        fm.addEventListener('click', () => { flagMode = !flagMode; fm.setAttribute('aria-pressed', flagMode); });

        reset();
        return () => clearInterval(timer);
      },
    });
  }

  /* =========================================================
     ЗМЕЙКА
     ========================================================= */
  function snake() {
    const N = 20;
    let api = {};
    WMN.window({
      id: 'snake', title: 'Змейка', icon: '🐍', width: 380,
      onKey(e) {
        if (e.key === ' ' || e.key === 'Enter') { api.startOrPause(); return true; }
        const d = KEYDIR[e.key] || KEYDIR[e.key.toLowerCase()];
        if (d) { api.turn(d); return true; }
      },
      build(body) {
        body.innerHTML = `
          <div class="g-score"><span>Счёт: <b data-score>0</b></span><span>Рекорд: <b data-best>0</b></span></div>
          <canvas class="snake-cv" width="320" height="320"></canvas>
          <div class="g-toolbar center"><button class="btn98" data-start>▶ Старт</button></div>
          <div class="dpad ${isTouch ? '' : 'hidden'}">
            <button class="btn98" data-d="up">▲</button><button class="btn98" data-d="left">◀</button>
            <button class="btn98" data-d="down">▼</button><button class="btn98" data-d="right">▶</button>
          </div>
          <p class="g-help">${isTouch ? 'Свайпы по полю или кнопки.' : 'Стрелки или WASD, пробел — пауза.'}</p>`;
        const cv = body.querySelector('canvas'), ctx = cv.getContext('2d'), C = cv.width / N;
        const $score = body.querySelector('[data-score]'), $best = body.querySelector('[data-best]'), $start = body.querySelector('[data-start]');
        const COL = { bg: '#9BB05A', grid: '#8FA451', snake: '#1E2B12', head: '#0B1206', food: '#4A1D0F', text: '#1E2B12' };
        let s, dir, queue, food, score, speed, loop = null, state = 'idle';
        $best.textContent = records().snake || 0;

        function place() { do { food = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 }; } while (s.some(p => p.x === food.x && p.y === food.y)); }
        function init() { s = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }]; dir = 'right'; queue = []; score = 0; speed = 140; $score.textContent = 0; place(); }
        const V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

        function draw(msg) {
          ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = COL.grid;
          for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) ctx.fillRect(i * C, j * C, C, C);
          ctx.fillStyle = COL.food; ctx.fillRect(food.x * C + 3, food.y * C + 3, C - 6, C - 6);
          s.forEach((p, i) => { ctx.fillStyle = i ? COL.snake : COL.head; ctx.fillRect(p.x * C + 1, p.y * C + 1, C - 2, C - 2); });
          if (msg) {
            ctx.fillStyle = 'rgba(155,176,90,.85)'; ctx.fillRect(0, cv.height / 2 - 34, cv.width, 68);
            ctx.fillStyle = COL.text; ctx.textAlign = 'center';
            ctx.font = 'bold 20px "Courier New", monospace'; ctx.fillText(msg[0], cv.width / 2, cv.height / 2 - 4);
            ctx.font = '14px "Courier New", monospace'; ctx.fillText(msg[1], cv.width / 2, cv.height / 2 + 20);
          }
        }

        function step() {
          if (queue.length) dir = queue.shift();
          const h = { x: s[0].x + V[dir][0], y: s[0].y + V[dir][1] };
          if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || s.some(p => p.x === h.x && p.y === h.y)) return gameOver();
          s.unshift(h);
          if (h.x === food.x && h.y === food.y) {
            score++; $score.textContent = score; place();
            speed = Math.max(60, speed - 3); clearInterval(loop); loop = setInterval(step, speed);
          } else s.pop();
          draw();
        }

        function gameOver() {
          clearInterval(loop); state = 'over';
          const best = records().snake || 0;
          if (score > best) { saveRecord('snake', score); $best.textContent = score; }
          draw(['ИГРА ОКОНЧЕНА', score > best ? `Новый рекорд: ${score}!` : `Счёт: ${score}`]);
          $start.textContent = '▶ Ещё раз';
        }

        api.startOrPause = () => {
          if (state === 'running') { clearInterval(loop); state = 'paused'; draw(['ПАУЗА', 'пробел — продолжить']); $start.textContent = '▶ Продолжить'; return; }
          if (state === 'idle' || state === 'over') init();
          state = 'running'; $start.textContent = '⏸ Пауза';
          clearInterval(loop); loop = setInterval(step, speed); draw();
        };
        api.turn = d => {
          if (state !== 'running') { if (state !== 'paused') api.startOrPause(); else return; }
          const last = queue.length ? queue[queue.length - 1] : dir;
          if (d !== last && d !== OPP[last] && queue.length < 3) queue.push(d);
        };

        $start.addEventListener('click', api.startOrPause);
        body.querySelector('.dpad').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) api.turn(b.dataset.d); });
        cv.style.touchAction = 'none';
        onSwipe(cv, api.turn);

        init(); draw(['ЗМЕЙКА', isTouch ? 'нажмите «Старт»' : 'стрелка или пробел — старт']);
        return () => clearInterval(loop);
      },
    });
  }

  /* =========================================================
     2048
     ========================================================= */
  function g2048() {
    let api = {};
    WMN.window({
      id: 'g2048', title: '2048', icon: '🔢', width: 380,
      onKey(e) { const d = KEYDIR[e.key] || KEYDIR[e.key.toLowerCase()]; if (d) { api.move(d); return true; } },
      build(body) {
        body.innerHTML = `
          <div class="g-score"><span>Счёт: <b data-score>0</b></span><span>Рекорд: <b data-best>0</b></span>
            <button class="btn98" data-new>Новая игра</button></div>
          <div class="t48-board"></div>
          <p class="g-help">${isTouch ? 'Свайпайте по полю.' : 'Стрелки или WASD.'} Соединяйте одинаковые плитки, чтобы получить 2048.</p>`;
        const board = body.querySelector('.t48-board'), $score = body.querySelector('[data-score]'), $best = body.querySelector('[data-best]');
        let g, score, won, fresh;
        $best.textContent = records().g2048 || 0;

        function add() {
          const empty = []; g.forEach((v, i) => { if (!v) empty.push(i); });
          if (!empty.length) return;
          const i = empty[(Math.random() * empty.length) | 0];
          g[i] = Math.random() < 0.9 ? 2 : 4; fresh = i;
        }
        function draw(merged = []) {
          board.innerHTML = g.map((v, i) =>
            `<div class="t48 ${v ? 'v' + Math.min(v, 4096) : ''} ${i === fresh ? 'pop' : ''} ${merged.includes(i) ? 'merge' : ''}">${v || ''}</div>`).join('');
          $score.textContent = score;
        }
        function reset() { g = Array(16).fill(0); score = 0; won = false; add(); add(); draw(); }

        const lines = {
          left:  [...Array(4)].map((_, r) => [0, 1, 2, 3].map(c => r * 4 + c)),
          right: [...Array(4)].map((_, r) => [3, 2, 1, 0].map(c => r * 4 + c)),
          up:    [...Array(4)].map((_, c) => [0, 1, 2, 3].map(r => r * 4 + c)),
          down:  [...Array(4)].map((_, c) => [3, 2, 1, 0].map(r => r * 4 + c)),
        };
        function canMove() {
          if (g.includes(0)) return true;
          for (let i = 0; i < 16; i++) { if (i % 4 < 3 && g[i] === g[i + 1]) return true; if (i < 12 && g[i] === g[i + 4]) return true; }
          return false;
        }

        api.move = dir => {
          let moved = false; const merged = [];
          for (const line of lines[dir]) {
            const vals = line.map(i => g[i]).filter(Boolean), out = [], mIdx = [];
            for (let k = 0; k < vals.length; k++) {
              if (vals[k] === vals[k + 1]) { out.push(vals[k] * 2); score += vals[k] * 2; mIdx.push(out.length - 1); k++; }
              else out.push(vals[k]);
            }
            while (out.length < 4) out.push(0);
            line.forEach((i, k) => { if (g[i] !== out[k]) moved = true; g[i] = out[k]; });
            mIdx.forEach(k => merged.push(line[k]));
          }
          if (!moved) return;
          add(); draw(merged);
          const best = records().g2048 || 0;
          if (score > best) { saveRecord('g2048', score); $best.textContent = score; }
          if (!won && g.includes(2048)) {
            won = true;
            WMN.dialog({ title: '2048!', icon: '🏆', html: '<p>Вы собрали 2048! Можно продолжать и попробовать дойти до 4096.</p>', buttons: [{ text: 'Играть дальше', default: true }, { text: 'Новая игра', action: reset }] });
          } else if (!canMove()) {
            WMN.dialog({ title: 'Игра окончена', icon: '🔢', html: `<p>Ходов больше нет. Счёт: <b>${score}</b>.</p>`, buttons: [{ text: 'Новая игра', default: true, action: reset }, { text: 'Закрыть' }] });
          }
        };

        body.querySelector('[data-new]').addEventListener('click', reset);
        board.style.touchAction = 'none';
        onSwipe(board, api.move);
        reset();
      },
    });
  }

  /* =========================================================
     КРЕСТИКИ-НОЛИКИ против компьютера
     ========================================================= */
  function ttt() {
    WMN.window({
      id: 'ttt', title: 'Крестики-нолики', icon: '❌', width: 340,
      build(body) {
        const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        let b, over, level = 'mid', youStart = true;
        const score = Object.assign({ you: 0, draw: 0, pc: 0 }, records().ttt || {});
        body.innerHTML = `
          <div class="g-toolbar"><div class="seg" data-lvl>
            <button class="btn98" data-v="easy" aria-pressed="false">Лёгкий</button>
            <button class="btn98" data-v="mid" aria-pressed="true">Средний</button>
            <button class="btn98" data-v="hard" aria-pressed="false">Невозможный</button></div></div>
          <div class="ttt-score"><span>Вы (✕): <b data-you>0</b></span><span>Ничьи: <b data-draw>0</b></span><span>ПК (○): <b data-pc>0</b></span></div>
          <div class="ttt-board">${[...Array(9)].map((_, i) => `<button class="ttt-c" data-i="${i}" aria-label="Клетка ${i + 1}"></button>`).join('')}</div>
          <p class="ttt-msg" data-msg></p>
          <div class="g-toolbar center"><button class="btn98" data-new>Новая партия</button></div>`;
        const cells = [...body.querySelectorAll('.ttt-c')], $msg = body.querySelector('[data-msg]');
        const showScore = () => ['you', 'draw', 'pc'].forEach(k => body.querySelector(`[data-${k}]`).textContent = score[k]);

        const winner = s => { for (const l of LINES) if (s[l[0]] && s[l[0]] === s[l[1]] && s[l[0]] === s[l[2]]) return { who: s[l[0]], line: l }; return s.every(Boolean) ? { who: 'draw' } : null; };
        function minimax(s, turn) {
          const w = winner(s);
          if (w) return { score: w.who === 'O' ? 10 : w.who === 'X' ? -10 : 0 };
          let best = { score: turn === 'O' ? -99 : 99 };
          s.forEach((v, i) => {
            if (v) return; s[i] = turn;
            const r = minimax(s, turn === 'O' ? 'X' : 'O'); s[i] = null;
            const sc = r.score - Math.sign(r.score);                  // быстрее выиграть, позже проиграть
            if (turn === 'O' ? sc > best.score : sc < best.score) best = { score: sc, i };
          });
          return best;
        }
        function pcMove() {
          const free = b.map((v, i) => v ? null : i).filter(i => i !== null);
          const smart = level === 'hard' || (level === 'mid' && Math.random() < 0.7);
          const i = smart ? minimax(b.slice(), 'O').i : free[(Math.random() * free.length) | 0];
          put(i, 'O');
        }
        function put(i, who) {
          b[i] = who; cells[i].textContent = who === 'X' ? '✕' : '○'; cells[i].classList.add(who === 'X' ? 'x' : 'o');
          const w = winner(b);
          if (!w) return;
          over = true;
          if (w.line) w.line.forEach(k => cells[k].classList.add('win'));
          if (w.who === 'X') { score.you++; $msg.textContent = level === 'hard' ? 'Как?! Это же невозможно!' : 'Победа! 🎉'; }
          else if (w.who === 'O') { score.pc++; $msg.textContent = 'Компьютер победил.'; }
          else { score.draw++; $msg.textContent = 'Ничья.'; }
          saveRecord('ttt', score); showScore();
        }
        function reset() {
          b = Array(9).fill(null); over = false;
          cells.forEach(c => { c.textContent = ''; c.className = 'ttt-c'; });
          $msg.textContent = youStart ? 'Ваш ход: вы играете крестиками.' : 'Компьютер ходит первым.';
          if (!youStart) setTimeout(pcMove, 350);
          youStart = !youStart;                                        // первый ход по очереди
        }
        body.querySelector('.ttt-board').addEventListener('click', e => {
          const c = e.target.closest('.ttt-c'); if (!c || over) return;
          const i = +c.dataset.i; if (b[i]) return;
          if (b.filter(v => v === 'X').length > b.filter(v => v === 'O').length) return;   // ждём ход компьютера
          put(i, 'X'); if (!over) { $msg.textContent = 'Компьютер думает…'; setTimeout(() => { pcMove(); if (!over) $msg.textContent = 'Ваш ход.'; }, 300); }
        });
        body.querySelector('[data-lvl]').addEventListener('click', e => {
          const x = e.target.closest('[data-v]'); if (!x) return;
          level = x.dataset.v; body.querySelectorAll('[data-lvl] [data-v]').forEach(y => y.setAttribute('aria-pressed', y === x));
          youStart = true; reset();
        });
        body.querySelector('[data-new]').addEventListener('click', reset);
        showScore(); reset();
      },
    });
  }

  /* =========================================================
     КИРПИЧИКИ (в духе арканоида)
     ========================================================= */
  function bricks() {
    const W = 360, H = 440;
    let api = {};
    WMN.window({
      id: 'bricks', title: 'Кирпичики', icon: '🧱', width: 400,
      onKey(e) {
        if (e.key === ' ' || e.key === 'Enter') { api.action(); return true; }
        const d = KEYDIR[e.key] || KEYDIR[e.key.toLowerCase()];
        if (d === 'left' || d === 'right') { api.key(d, true); return true; }
      },
      build(body) {
        body.innerHTML = `
          <div class="g-score"><span>Счёт: <b data-score>0</b></span><span>Жизни: <b data-lives>♥♥♥</b></span><span>Рекорд: <b data-best>0</b></span></div>
          <canvas class="bricks-cv"></canvas>
          <p class="g-help">${isTouch ? 'Водите пальцем по полю, нажатие — запустить мяч.' : 'Мышь или стрелки, пробел или клик — запустить мяч / пауза.'}</p>`;
        const cv = body.querySelector('canvas'), ctx = cv.getContext('2d');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
        const $score = body.querySelector('[data-score]'), $lives = body.querySelector('[data-lives]'), $best = body.querySelector('[data-best]');
        $best.textContent = records().bricks || 0;
        const COLORS = ['#E0301E', '#FF8A00', '#FFD400', '#FFE600', '#6F9BE0', '#2B5CA8', '#0A246A'];
        const COLS = 8, BW = 40, BH = 16, GAP = 4, TOP = 50;
        let paddle, ball, wall, score, lives, level, state, raf, last, keys = { left: false, right: false };

        function buildWall() {
          const rows = Math.min(7, 4 + level);
          wall = [];
          const x0 = (W - (COLS * BW + (COLS - 1) * GAP)) / 2;
          for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++)
            wall.push({ x: x0 + c * (BW + GAP), y: TOP + r * (BH + GAP), color: COLORS[r % COLORS.length], alive: true, pts: (rows - r) * 10 });
        }
        function resetBall() { ball = { x: paddle.x, y: H - 46, r: 6, vx: 0, vy: 0, stuck: true }; }
        function newGame() {
          paddle = { x: W / 2, w: 64, h: 10, y: H - 30 };
          score = 0; lives = 3; level = 1; buildWall(); resetBall(); state = 'ready'; hud(); draw();
        }
        function hud() { $score.textContent = score; $lives.textContent = '♥'.repeat(Math.max(0, lives)) || '—'; }
        const speed = () => 260 + level * 30;

        function launch() {
          const a = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
          ball.vx = Math.cos(a) * speed(); ball.vy = Math.sin(a) * speed(); ball.stuck = false;
        }
        api.action = () => {
          if (state === 'over') { newGame(); return; }
          if (state === 'ready') { state = 'play'; launch(); loop(); return; }
          if (state === 'play') { state = 'pause'; cancelAnimationFrame(raf); draw('ПАУЗА', 'пробел или клик — продолжить'); return; }
          if (state === 'pause') { state = 'play'; loop(); }
        };
        api.key = (d, down) => { keys[d] = down; };
        const keyUp = e => { const d = KEYDIR[e.key] || KEYDIR[(e.key || '').toLowerCase()]; if (d === 'left' || d === 'right') keys[d] = false; };
        document.addEventListener('keyup', keyUp);

        // мышь и палец двигают платформу
        const toX = e => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) * W / r.width; };
        cv.style.touchAction = 'none';
        cv.addEventListener('pointermove', e => { paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, toX(e))); if (ball.stuck) ball.x = paddle.x; if (state !== 'play') draw(state === 'pause' ? ['ПАУЗА', ''] : null); });
        cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') cv.dispatchEvent(new PointerEvent('pointermove', e)); api.action(); });

        function loop() {
          last = performance.now();
          const tick = t => {
            if (state !== 'play') return;
            const dt = Math.min(0.03, (t - last) / 1000); last = t;
            if (!document.hidden) update(dt);
            draw();
            if (state === 'play') raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }

        function update(dt) {
          const pv = 420 * dt;
          if (keys.left) paddle.x -= pv; if (keys.right) paddle.x += pv;
          paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x));
          if (ball.stuck) { ball.x = paddle.x; return; }
          // несколько маленьких шагов, чтобы быстрый мяч не проскакивал кирпичи
          const steps = 4;
          for (let s = 0; s < steps; s++) {
            ball.x += ball.vx * dt / steps; ball.y += ball.vy * dt / steps;
            if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
            if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
            if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
            // платформа: угол отскока зависит от места удара
            if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y < paddle.y + paddle.h && Math.abs(ball.x - paddle.x) <= paddle.w / 2 + ball.r) {
              const k = (ball.x - paddle.x) / (paddle.w / 2);
              const a = -Math.PI / 2 + k * 1.05, v = Math.hypot(ball.vx, ball.vy);
              ball.vx = Math.cos(a) * v; ball.vy = Math.sin(a) * v; ball.y = paddle.y - ball.r;
            }
            for (const br of wall) {
              if (!br.alive) continue;
              if (ball.x + ball.r < br.x || ball.x - ball.r > br.x + BW || ball.y + ball.r < br.y || ball.y - ball.r > br.y + BH) continue;
              br.alive = false; score += br.pts; hud();
              const ox = Math.min(ball.x + ball.r - br.x, br.x + BW - (ball.x - ball.r));
              const oy = Math.min(ball.y + ball.r - br.y, br.y + BH - (ball.y - ball.r));
              if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
              break;
            }
          }
          if (ball.y - ball.r > H) {                                    // мяч упал
            lives--; hud();
            if (lives <= 0) return gameOver();
            resetBall(); state = 'ready'; draw('МИМО!', 'пробел или нажатие — запустить');
          }
          if (wall.every(b => !b.alive)) {                               // уровень пройден
            level++; buildWall(); resetBall(); state = 'ready';
            draw(`УРОВЕНЬ ${level}`, 'пробел или нажатие — поехали');
          }
        }

        function gameOver() {
          state = 'over';
          const best = records().bricks || 0;
          if (score > best) { saveRecord('bricks', score); $best.textContent = score; }
          draw('ИГРА ОКОНЧЕНА', score > best ? `Новый рекорд: ${score}!` : `Счёт: ${score}. Пробел — заново`);
        }

        function draw(t1, t2) {
          if (Array.isArray(t1)) [t1, t2] = t1;
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
          for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect((i * 97) % W, (i * 53) % H, 1, 1); }
          for (const br of wall) {
            if (!br.alive) continue;
            ctx.fillStyle = br.color; ctx.fillRect(br.x, br.y, BW, BH);
            ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(br.x, br.y, BW, 2); ctx.fillRect(br.x, br.y, 2, BH);
            ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(br.x, br.y + BH - 2, BW, 2); ctx.fillRect(br.x + BW - 2, br.y, 2, BH);
          }
          ctx.fillStyle = '#D4D0C8'; ctx.fillRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h);
          ctx.fillStyle = '#fff'; ctx.fillRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, 2);
          ctx.fillStyle = '#404040'; ctx.fillRect(paddle.x - paddle.w / 2, paddle.y + paddle.h - 2, paddle.w, 2);
          ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fillStyle = '#FFE600'; ctx.fill();
          ctx.fillStyle = '#6F9BE0'; ctx.font = '12px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.fillText('УРОВЕНЬ ' + level, 8, 20);
          if (t1) {
            ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, H / 2 - 36, W, 72);
            ctx.textAlign = 'center'; ctx.fillStyle = '#FFE600'; ctx.font = 'bold 22px "Courier New", monospace'; ctx.fillText(t1, W / 2, H / 2 - 4);
            ctx.fillStyle = '#fff'; ctx.font = '13px "Courier New", monospace'; ctx.fillText(t2 || '', W / 2, H / 2 + 20);
          }
        }

        newGame();
        draw('КИРПИЧИКИ', isTouch ? 'нажмите на поле, чтобы начать' : 'пробел или клик — старт');
        return () => { cancelAnimationFrame(raf); state = 'closed'; document.removeEventListener('keyup', keyUp); };
      },
    });
  }

  window.GAMES = { mines, snake, g2048, ttt, bricks };
})();
