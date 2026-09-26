/* =========================================================
   wmn-lab.ru — общий скрипт сайта
   Здесь настраивается ВСЁ общее: разделы, соцсети, меню окна,
   темы, шапка, футер, статусная строка, счётчик.
   Страницы содержат только свой контент внутри <main id="page">.
   ========================================================= */

const SITE = {
  name: 'wmn-lab',
  domain: 'wmn-lab.ru',
  version: '1.2',
  tagline: 'домашняя страничка: проекты, промпты и прочие приколы',
  shareText: 'wmn-lab — домашняя страничка wmn: промпты для нейросетей, калькулятор теста и прочие приколы. Всё бесплатно и без регистрации.',
  updated: '26.09.2026',            // «Последнее обновление» в футере
  marquee: '*** Добро пожаловать на wmn-lab! *** Сайт только открылся и понемногу обживается *** Заходите почаще ***',

  /* Разделы сайта.
     ready: true  — раздел показывается в меню.
     ready: false — раздел скрыт из меню и попадает в блок «Что тут будет» на главной. */
  sections: [
    { id: 'home',    title: 'Главная',           icon: '🏠', href: '/',         ready: true },
    { id: 'prompts', title: 'Промпты',           icon: '📜', href: '/prompts/', ready: true,
      soonTitle: 'Промпты и гайды',
      soon: 'Готовые сценарии для нейросетей и подсказки, как с ними работать. Можно будет скопировать или скачать файлом.' },
    { id: 'dough',   title: 'Калькулятор теста', icon: '🥧', href: '/dough/',   ready: true,
      soon: 'Выбираете рецепт и свою форму, а количество ингредиентов пересчитывается само.' },
    { id: 'bot',     title: 'Бот с картинками',  icon: '🤖', href: '/bot/',     ready: true,
      soonTitle: 'Бот с подписями на картинках',
      soon: 'Мой телеграм-бот для мемов и, если всё получится, его версия прямо в браузере.' },
  ],

  /* Соцсети: кнопки в футере и пункты в «Избранном» */
  socials: [
    { cls: 'tg', name: 'Telegram',  handle: '@wmncustoms',   url: 'https://t.me/wmncustoms' },
    { cls: 'ig', name: 'Instagram', handle: '@waitmenearby', url: 'https://www.instagram.com/waitmenearby/' },
    { cls: 'yt', name: 'YouTube',   handle: '@waitmenear',   url: 'https://www.youtube.com/@waitmenear' },
  ],

  themes: [
    { id: 'classic', title: 'Светлая (классическая)' },
    { id: 'dark',    title: 'Тёмная' },
    { id: 'retro',   title: 'Ретро: Vice City' },
    { id: 'matrix',  title: 'Матрица' },
  ],
};

/* ---------------- Общие помощники ---------------- */
const WMN = {
  async loadJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Не удалось загрузить ' + url);
    return r.json();
  },
  async loadText(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Не удалось загрузить ' + url);
    return r.text();
  },
  async copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const t = document.createElement('textarea'); t.value = text;
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
  },
  status(text, ms) {
    const s = document.getElementById('status'); if (!s) return;
    s.textContent = text;
    clearTimeout(WMN._st);
    if (ms) WMN._st = setTimeout(() => { s.textContent = 'Готово'; }, ms);
  },
  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  },
  date(iso) { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; },
  icon(name) { return (window.__ICONS && window.__ICONS[name]) || `/assets/img/icons/${name}.png`; },
  isFresh(iso) { return (Date.now() - new Date(iso).getTime()) < 14 * 864e5; },

  /* Диалоговое окно в стиле Win98.
     WMN.dialog({ title, icon, html, cls, buttons: [{ text, action, default: true }] }) */
  dialog({ title = SITE.name, icon = 'ℹ️', html = '', cls = '', buttons = [{ text: 'OK', default: true }] }) {
    const back = document.createElement('div');
    back.className = 'dlg-back';
    back.innerHTML = `
      <div class="dlg ${cls}" role="dialog" aria-modal="true" aria-label="${WMN.esc(title)}">
        <div class="titlebar"><span class="t">${WMN.esc(title)}</span><button class="tb-btn" data-x aria-label="Закрыть">×</button></div>
        <div class="dlg-body">${icon ? `<div class="dlg-ico" aria-hidden="true">${icon}</div>` : ''}<div class="dlg-text">${html}</div></div>
        <div class="dlg-btns">${buttons.map((b, i) => `<button class="btn98 ${b.default ? 'default' : ''}" data-i="${i}">${WMN.esc(b.text)}</button>`).join('')}</div>
      </div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { const d = buttons.findIndex(b => b.default); if (d >= 0) back.querySelector(`[data-i="${d}"]`).click(); }
    };
    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('[data-x]')) return close();
      const b = e.target.closest('[data-i]'); if (!b) return;
      const btn = buttons[+b.dataset.i];
      if (btn.action && btn.action(back) === false) return;   // action может вернуть false, чтобы окно не закрывалось
      close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    (back.querySelector('.default') || back.querySelector('.btn98')).focus();
    return back;
  },
};

/* ---------------- Плавающие окна (игры и т.п.) ----------------
   WMN.window({ id, title, icon, width, build(body, win) → cleanup?, onKey(e) → true, если клавиша обработана }) */
WMN._z = 900;
WMN._wins = {};
WMN.activeWin = null;
WMN.window = function ({ id, title, icon = '🗔', width = 360, big = false, build, onKey }) {
  if (WMN._wins[id]) { WMN._wins[id].focus(); return WMN._wins[id]; }
  const el = document.createElement('div');
  el.className = 'gwin' + (big ? ' big' : '');
  el.style.width = `min(${width}px, calc(100vw - 16px))`;
  el.innerHTML = `
    <div class="titlebar"><span class="gwin-ico" aria-hidden="true">${icon}</span><span class="t">${WMN.esc(title)}</span>
      <button class="tb-btn" data-x aria-label="Закрыть">×</button></div>
    <div class="gwin-body"></div>`;
  document.body.appendChild(el);
  const n = Object.keys(WMN._wins).length;
  el.style.left = Math.max(8, (innerWidth - el.offsetWidth) / 2 + n * 24) + 'px';
  el.style.top = Math.max(8, Math.min(90 + n * 24, innerHeight - 120)) + 'px';

  const win = {
    el, onKey,
    focus() { el.style.zIndex = ++WMN._z; WMN.activeWin = win; document.querySelectorAll('.gwin').forEach(w => w.classList.toggle('inactive', w !== el)); },
    close() { win.cleanup && win.cleanup(); el.remove(); delete WMN._wins[id]; if (WMN.activeWin === win) WMN.activeWin = null; },
  };
  WMN._wins[id] = win;
  el.addEventListener('pointerdown', () => win.focus());
  el.querySelector('[data-x]').addEventListener('click', () => win.close());

  // перетаскивание за заголовок
  const bar = el.querySelector('.titlebar');
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      el.style.left = Math.min(Math.max(0, ev.clientX - ox), innerWidth - 60) + 'px';
      el.style.top = Math.min(Math.max(0, ev.clientY - oy), innerHeight - 30) + 'px';
    };
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
  });

  win.cleanup = build(el.querySelector('.gwin-body'), win);
  win.focus();
  return win;
};
document.addEventListener('keydown', e => {
  const w = WMN.activeWin;
  if (!w || !w.onKey || document.querySelector('.dlg-back')) return;
  if (e.target.closest && e.target.closest('input, textarea, select')) return;
  if (w.onKey(e)) {
    e.preventDefault();
    // иначе пробел ещё и «нажмёт» последнюю кликнутую кнопку в окне
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  }
});

/* ---------------- Вид: тема, крупный шрифт, без анимации ---------------- */
const VIEW = {
  get() { try { return JSON.parse(localStorage.getItem('wmn-view')) || {}; } catch (e) { return {}; } },
  set(patch) {
    const v = Object.assign(VIEW.get(), patch);
    try { localStorage.setItem('wmn-view', JSON.stringify(v)); } catch (e) {}
    VIEW.apply();
  },
  apply() {
    const v = VIEW.get(), root = document.documentElement;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.dataset.theme = v.theme || 'classic';
    root.classList.toggle('big', !!v.big);
    root.classList.toggle('noanim', !!v.noanim || reduce);
    // декорации тем
    document.querySelector('.vice')?.remove();
    MATRIX.stop();
    if (root.dataset.theme === 'retro') VIEW.vice();
    if (root.dataset.theme === 'matrix') MATRIX.start(root.classList.contains('noanim'));
    VIEW.syncMenu && VIEW.syncMenu();
  },
  vice() {
    const palm = `<svg class="vice-palm %C" viewBox="0 0 200 300" aria-hidden="true"><g fill="#0D0221">
      <path d="M96 300 C 100 220, 108 160, 118 110 L 126 112 C 118 160, 112 220, 110 300 Z"/>
      <path d="M120 110 C 90 80, 50 80, 10 105 C 50 92, 85 98, 118 118 Z"/>
      <path d="M120 110 C 100 70, 70 45, 30 40 C 70 58, 95 80, 116 116 Z"/>
      <path d="M122 108 C 130 70, 150 40, 190 30 C 158 55, 140 80, 126 116 Z"/>
      <path d="M124 112 C 150 95, 180 100, 200 125 C 175 110, 150 110, 126 120 Z"/>
      <path d="M121 110 C 118 80, 120 55, 135 25 C 128 60, 128 85, 125 114 Z"/></g></svg>`;
    const el = document.createElement('div');
    el.className = 'vice'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="vice-sun"></div><div class="vice-grid"></div>${palm.replace('%C', 'l')}${palm.replace('%C', 'r')}`;
    document.body.prepend(el);
  },
};

/* «Цифровой дождь» для темы Матрица */
const MATRIX = {
  raf: null,
  start(still) {
    const c = document.createElement('canvas'); c.id = 'matrix-rain'; c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c);
    const ctx = c.getContext('2d');
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789WMN'.split('');
    const size = 16; let cols = 0, drops = [];
    const resize = () => { c.width = innerWidth; c.height = innerHeight; cols = Math.ceil(c.width / size); drops = Array.from({ length: cols }, () => Math.random() * c.height / size); };
    resize(); addEventListener('resize', resize); MATRIX._resize = resize;
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = size + 'px monospace';
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = Math.random() > 0.975 ? '#D8FFE2' : '#1FCF4C';
        ctx.fillText(chars[(Math.random() * chars.length) | 0], i * size, drops[i] * size);
        if (drops[i] * size > c.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    if (still) { for (let i = 0; i < 60; i++) draw(); return; }
    let last = 0;
    const loop = t => { MATRIX.raf = requestAnimationFrame(loop); if (t - last > 55 && !document.hidden) { last = t; draw(); } };
    MATRIX.raf = requestAnimationFrame(loop);
  },
  stop() {
    cancelAnimationFrame(MATRIX.raf); MATRIX.raf = null;
    if (MATRIX._resize) removeEventListener('resize', MATRIX._resize);
    document.getElementById('matrix-rain')?.remove();
  },
};

VIEW.apply();

/* ---------------- Действия пунктов меню ---------------- */
let tipClicks = 0, tipTimer = null;
const ACTIONS = {
  print() { window.print(); },

  share() {
    const url = location.href.split('#')[0];
    const text = SITE.shareText + '\n' + url;
    WMN.dialog({
      title: 'Поделиться', icon: '🔗',
      html: `<p>Ссылка на эту страницу:</p><input type="text" readonly value="${WMN.esc(url)}" onclick="this.select()">
             <p class="muted" style="margin-top:8px">Кнопка «Копировать» скопирует ссылку вместе с коротким описанием сайта.</p>`,
      buttons: [
        { text: 'Копировать', default: true, action: () => { WMN.copy(text); WMN.status('Ссылка с описанием скопирована', 4000); } },
        ...(navigator.share ? [{ text: 'Отправить…', action: () => { navigator.share({ title: SITE.name, text: SITE.shareText, url }).catch(() => {}); } }] : []),
        { text: 'Закрыть' },
      ],
    });
  },

  exit() {
    WMN.dialog({
      title: 'Выход из Интернета', icon: '❓',
      html: '<p>Вы действительно хотите выйти из Интернета?</p>',
      buttons: [{ text: 'Да', action: ACTIONS.shutdown }, { text: 'Нет', default: true }],
    });
  },
  shutdown() {
    window.close();                         // сработает, только если браузер разрешит
    setTimeout(() => {
      const s = document.createElement('div'); s.className = 'shutdown wait';
      s.innerHTML = '<p>Подождите, идёт завершение работы Интернета…</p>';
      document.body.appendChild(s);
      setTimeout(() => {
        s.classList.remove('wait');
        s.innerHTML = '<p>Теперь питание компьютера<br>можно отключить.</p><small>кликните, чтобы включить обратно</small>';
        s.addEventListener('click', () => location.reload());
      }, 1600);
    }, 250);
  },

  copyUrl() { WMN.copy(location.href.split('#')[0]); WMN.status('Адрес страницы скопирован', 3000); },
  find() {
    WMN.dialog({ title: 'Найти на странице', icon: '🔍',
      html: '<p>Нажмите <b>Ctrl+F</b> (на Mac — <b>⌘+F</b>) и введите, что ищете.</p><p>На телефоне: меню браузера → «Найти на странице».</p>' });
  },
  theme(id) { VIEW.set({ theme: id }); WMN.status('Тема: ' + SITE.themes.find(t => t.id === id).title, 3000); },
  big() { VIEW.set({ big: !VIEW.get().big }); },
  noanim() { VIEW.set({ noanim: !VIEW.get().noanim }); },
  fullscreen() {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else if (el.requestFullscreen || el.webkitRequestFullscreen) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    else WMN.dialog({ title: 'Во весь экран', icon: '🖥️', html: '<p>Этот браузер не умеет открывать сайты во весь экран. На iPhone можно добавить сайт на экран «Домой»: он будет открываться без адресной строки.</p>' });
  },
  addFav() {
    WMN.dialog({ title: 'Добавить в избранное', icon: '⭐',
      html: '<p>Браузеры не разрешают сайтам добавлять себя в закладки сами, поэтому нажмите <b>Ctrl+D</b> (на Mac — <b>⌘+D</b>).</p><p>На телефоне: «Поделиться» → «На экран Домой» или «Добавить в закладки».</p>' });
  },
  about() {
    WMN.dialog({ title: 'О программе ' + SITE.name, icon: '',
      html: `<div class="about-logo">${SITE.name}</div>
        <p><b>Домашняя страничка wmn</b><br>Версия ${SITE.version} (сборка ${SITE.updated})</p>
        <p>Промпты, гайды, маленькие инструменты и прочие приколы. Бесплатно, без регистрации и СМС.</p>
        <p>Сделано в блокноте и нейросети.<br>© 2026 wmn</p>
        <p>${SITE.socials.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`).join(' · ')}</p>` });
  },
  tip() {
    const msgs = ['Совет дня пока не работает. Честно.', 'Всё ещё не работает.', 'Ну серьёзно…', 'Последнее предупреждение!'];
    tipClicks++;
    clearTimeout(tipTimer); tipTimer = setTimeout(() => { tipClicks = 0; }, 20000);
    if (tipClicks < 5) { WMN.status(msgs[tipClicks - 1], 4000); return; }
    tipClicks = 0;
    const d = WMN.dialog({ title: 'Ошибка', icon: '⚠️', cls: 'dlg-error',
      html: '<p>Я ЖЕ ПРОСИЛ НЕ НАЖИМАТЬ!</p>', buttons: [{ text: 'Простите', default: true }] });
    d.querySelector('.dlg').classList.add('shake');
  },
  write() { window.open(SITE.socials[0].url, '_blank', 'noopener'); },
  game(id) {
    const open = () => window.GAMES[id]();
    if (window.GAMES) return open();
    WMN.status('Загрузка игры…');
    const sc = document.createElement('script');
    sc.src = '/assets/js/games.js?v=2';
    sc.onload = () => { WMN.status('Готово'); open(); };
    sc.onerror = () => WMN.status('Не удалось загрузить игру', 4000);
    document.head.appendChild(sc);
  },
};

/* ---------------- Сборка меню ---------------- */
function buildMenu() {
  const item = (label, act, extra = '') => `<button class="mi" role="menuitem" data-act="${act}" ${extra}>${label}</button>`;
  const link = (label, href, blank) => `<a class="mi" role="menuitem" href="${href}" ${blank ? 'target="_blank" rel="noopener"' : ''}>${label}</a>`;
  const sep = '<hr class="msep">';
  const ready = SITE.sections.filter(s => s.ready);
  const menus = [
    ['Ф', 'айл', [
      `<div class="mi has-sub" tabindex="0" role="menuitem" aria-haspopup="true">Открыть<div class="menu-drop sub" role="menu">${ready.map(s => link(`${s.icon} ${s.title}`, s.href)).join('')}</div></div>`,
      item('Печать…<span class="sc">Ctrl+P</span>', 'print'),
      item('Поделиться…', 'share'),
      sep,
      item('Выход', 'exit'),
    ]],
    ['П', 'равка', [
      item('Отменить<span class="sc">Ctrl+Z</span>', '', 'disabled aria-disabled="true"').replace('class="mi"', 'class="mi disabled"'),
      sep,
      item('Копировать адрес', 'copyUrl'),
      item('Найти на странице…<span class="sc">Ctrl+F</span>', 'find'),
    ]],
    ['В', 'ид', [
      `<div class="mi has-sub" tabindex="0" role="menuitem" aria-haspopup="true">Тема<div class="menu-drop sub" role="menu">${SITE.themes.map(t => `<button class="mi" role="menuitemradio" data-act="theme" data-arg="${t.id}"><span class="chk"></span>${t.title}</button>`).join('')}</div></div>`,
      sep,
      `<button class="mi" role="menuitemcheckbox" data-act="big"><span class="chk"></span>Крупный шрифт</button>`,
      `<button class="mi" role="menuitemcheckbox" data-act="noanim"><span class="chk"></span>Без анимации</button>`,
      sep,
      item('Во весь экран<span class="sc">F11</span>', 'fullscreen'),
    ]],
    ['И', 'збранное', [
      ...SITE.socials.map(s => link(`${s.name} <span class="sc">${s.handle}</span>`, s.url, true)),
      sep,
      ...ready.filter(s => s.id !== 'home').map(s => link(`${s.icon} ${s.title}`, s.href)),
      sep,
      item('Добавить в избранное…<span class="sc">Ctrl+D</span>', 'addFav'),
    ]],
    ['И', 'гры', [
      item('💣 Сапёр', 'game', 'data-arg="mines"'),
      item('🐍 Змейка', 'game', 'data-arg="snake"'),
      item('🔢 2048', 'game', 'data-arg="g2048"'),
      item('❌ Крестики-нолики', 'game', 'data-arg="ttt"'),
      item('🧱 Кирпичики', 'game', 'data-arg="bricks"'),
    ]],
    ['С', 'правка', [
      item('О сайте…', 'about'),
      item('Совет дня <span class="sc">(ещё не работает, не нажимайте)</span>', 'tip'),
      sep,
      item('Написать мне в Telegram', 'write'),
    ]],
  ];
  return `<div class="menubar" role="menubar">${menus.map(([u, rest, items]) => `
    <div class="menu"><button class="menu-title" aria-haspopup="true"><u>${u}</u>${rest}</button>
      <div class="menu-drop" role="menu">${items.join('')}</div></div>`).join('')}</div>`;
}

function wireMenu(bar) {
  const closeAll = () => { bar.querySelectorAll('.open').forEach(m => m.classList.remove('open')); bar.classList.remove('active'); };
  bar.addEventListener('click', e => {
    const title = e.target.closest('.menu-title');
    if (title) {
      const m = title.parentElement, was = m.classList.contains('open');
      closeAll();
      if (!was) { m.classList.add('open'); bar.classList.add('active'); }
      return;
    }
    const sub = e.target.closest('.has-sub');
    if (sub && !e.target.closest('.sub')) { sub.classList.toggle('open'); return; }
    const mi = e.target.closest('.mi');
    if (!mi || mi.classList.contains('disabled')) return;
    closeAll();
    if (mi.dataset.act && ACTIONS[mi.dataset.act]) ACTIONS[mi.dataset.act](mi.dataset.arg);
  });
  // как в Windows: пока одно меню открыто, наведение на соседнее переключает его
  bar.querySelectorAll('.menu').forEach(m => m.addEventListener('mouseenter', () => {
    if (bar.classList.contains('active') && !m.classList.contains('open')) { closeAll(); m.classList.add('open'); bar.classList.add('active'); }
  }));
  // на компьютере меню открывается наведением
  if (matchMedia('(hover: hover)').matches) {
    bar.querySelectorAll('.menu').forEach(m => {
      m.addEventListener('mouseenter', () => { closeAll(); m.classList.add('open'); bar.classList.add('active'); });
      m.addEventListener('mouseleave', () => { m.classList.remove('open'); bar.classList.remove('active'); });
    });
  }
  document.addEventListener('click', e => { if (!bar.contains(e.target)) closeAll(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  VIEW.syncMenu = () => {
    const v = VIEW.get(), theme = v.theme || 'classic';
    bar.querySelectorAll('[data-act="theme"]').forEach(b => { const on = b.dataset.arg === theme; b.querySelector('.chk').textContent = on ? '●' : ''; b.setAttribute('aria-checked', on); });
    [['big', v.big], ['noanim', v.noanim]].forEach(([a, on]) => { const b = bar.querySelector(`[data-act="${a}"]`); b.querySelector('.chk').textContent = on ? '✓' : ''; b.setAttribute('aria-checked', !!on); });
  };
  VIEW.syncMenu();
}

/* ---------------- Сборка каркаса страницы ---------------- */
(function buildChrome() {
  const page = document.getElementById('page');
  if (!page) return;

  const current = document.body.dataset.section || '';
  const pageTitle = page.dataset.title || SITE.name;
  const ready = SITE.sections.filter(s => s.ready);
  const showNav = ready.length > 1;

  const header = document.createElement('header');
  header.className = 'masthead';
  header.innerHTML = `
    <a href="/" aria-label="${SITE.name}, на главную"><div class="wordart">${SITE.name}</div></a>
    <p class="tagline">${SITE.tagline}</p>`;

  const win = document.createElement('div');
  win.className = 'window';
  win.innerHTML = `
    <div class="titlebar">
      <span aria-hidden="true">🖥️</span>
      <span class="t">${WMN.esc(pageTitle)} — ${SITE.domain}</span>
      <button class="tb-btn" data-act="noop" aria-label="Свернуть" title="Свернуть">_</button>
      <button class="tb-btn" data-act="fullscreen" aria-label="Во весь экран" title="Во весь экран">□</button>
      <button class="tb-btn" data-act="exit" aria-label="Закрыть" title="Закрыть">×</button>
    </div>
    ${buildMenu()}
    <div class="win-body ${showNav ? '' : 'single'}">
      ${showNav ? `
      <nav class="nav" aria-label="Разделы">
        <p class="navtitle">Разделы сайта</p>
        <div class="navlist">
          ${ready.map(s => `<a class="navbtn" href="${s.href}" ${s.id === current ? 'aria-current="page"' : ''}><span class="ico" aria-hidden="true">${s.icon}</span>${s.title}</a>`).join('')}
        </div>
      </nav>` : ''}
      <section class="content"></section>
    </div>
    <div class="statusbar">
      <div class="sb-main"><span id="status">Загрузка…</span><span class="sb-bar run" aria-hidden="true"></span></div>
      <div class="sb-today" id="sb-today" title="Посетителей сегодня">👀 Сегодня: …</div>
      <div class="sb-clock" id="sb-clock">--:--</div>
    </div>`;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div>Вы посетитель №</div>
    <div class="counter empty" id="counter" aria-label="Счётчик посетителей"><b>0</b><b>0</b><b>0</b><b>0</b><b>0</b><b>0</b></div>
    <div class="buttons88">
      ${SITE.socials.map(s => `<a class="b88 ${s.cls}" href="${s.url}" target="_blank" rel="noopener"><span>${s.name.toUpperCase()}</span><span class="h">${s.handle}</span></a>`).join('')}
      <div class="b88 a" aria-hidden="true"><span>СДЕЛАНО</span><span>В БЛОКНОТЕ</span></div>
    </div>
    <div>Последнее обновление: ${SITE.updated}</div>`;

  page.parentNode.insertBefore(header, page);
  page.parentNode.insertBefore(win, page);
  win.querySelector('.content').appendChild(page);
  win.after(footer);

  wireMenu(win.querySelector('.menubar'));
  win.querySelector('.titlebar').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'noop') WMN.status('Свернуть не получится: сайт слишком хорош', 3500);
    else ACTIONS[b.dataset.act]();
  });

  // Бегущая строка, если странице она нужна: <div data-marquee></div>
  document.querySelectorAll('[data-marquee]').forEach(el => {
    el.className = 'marquee'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<span>${WMN.esc(SITE.marquee)}</span>`;
  });

  /* ---- Статусная строка ---- */
  const bar = win.querySelector('.sb-bar');
  setTimeout(() => { WMN.status('Готово'); bar.classList.remove('run'); bar.style.display = 'none'; }, 700);

  // адрес ссылки при наведении — как в Internet Explorer
  document.addEventListener('mouseover', e => {
    const a = e.target.closest('a[href]');
    if (a) WMN.status(a.href); else if (e.target.closest('.menubar')) return;
  });
  document.addEventListener('mouseout', e => { if (e.target.closest('a[href]')) WMN.status('Готово'); });
  // полоска загрузки при переходе на другую страницу сайта
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.origin !== location.origin || e.ctrlKey || e.metaKey) return;
    WMN.status('Открывается ' + a.href);
    bar.style.display = ''; bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run');
  });

  const clock = document.getElementById('sb-clock');
  const tick = () => { const d = new Date(); clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  tick(); setInterval(tick, 15000);

  /* ---- Счётчик посетителей: /data/counter.json обновляет сервер раз в пару минут ---- */
  WMN.loadJSON('/data/counter.json').then(c => {
    const box = document.getElementById('counter');
    box.innerHTML = String(c.total).padStart(6, '0').split('').map(d => `<b>${d}</b>`).join('');
    box.classList.remove('empty');
    box.setAttribute('aria-label', 'Посетителей всего: ' + c.total);
    document.getElementById('sb-today').textContent = '👀 Сегодня: ' + c.today;
  }).catch(() => { document.getElementById('sb-today').style.display = 'none'; });
})();
