/* =========================================================
   wmn-lab.ru — общий скрипт сайта
   Здесь настраивается ВСЁ общее: разделы, меню, шапка, футер.
   Страницы содержат только свой контент внутри <main id="page">.
   ========================================================= */

const SITE = {
  name: 'wmn-lab',
  domain: 'wmn-lab.ru',
  tagline: 'домашняя страничка: проекты, промпты и прочие приколы',
  updated: '23.09.2026',            // «Последнее обновление» в футере
  marquee: '*** Добро пожаловать на wmn-lab! *** Сайт только открылся и понемногу обживается *** Заходите почаще ***',

  /* Разделы сайта.
     ready: true  — раздел показывается в меню.
     ready: false — раздел скрыт из меню и попадает в блок «Что тут будет» на главной.
     Чтобы открыть раздел: поставь ready: true. Всё. */
  sections: [
    { id: 'home',    title: 'Главная',           icon: '🏠', href: '/',         ready: true },
    { id: 'prompts', title: 'Промпты',           icon: '📜', href: '/prompts/', ready: false,
      soonTitle: 'Промпты и гайды',
      soon: 'Готовые сценарии для нейросетей и подсказки, как с ними работать. Можно будет скопировать или скачать файлом.' },
    { id: 'dough',   title: 'Калькулятор теста', icon: '🥧', href: '/dough/',   ready: false,
      soon: 'Выбираете рецепт и свою форму, а количество ингредиентов пересчитывается само.' },
    { id: 'bot',     title: 'Бот с картинками',  icon: '🤖', href: '/bot/',     ready: false,
      soonTitle: 'Бот с подписями на картинках',
      soon: 'Мой телеграм-бот для мемов и, если всё получится, его версия прямо в браузере.' },
  ],
};

/* ---------------- Общие помощники для страниц ---------------- */
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
  status(text) {
    const s = document.getElementById('status'); if (s) s.textContent = text;
  },
  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  },
  // '2026-09-23' → '23.09.2026'
  date(iso) { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; },
  // свежая запись — моложе 14 дней
  isFresh(iso) { return (Date.now() - new Date(iso).getTime()) < 14 * 864e5; },
};

/* ---------------- Сборка каркаса страницы ---------------- */
(function buildChrome() {
  const page = document.getElementById('page');
  if (!page) return;

  const current = document.body.dataset.section || '';
  const pageTitle = page.dataset.title || SITE.name;
  const ready = SITE.sections.filter(s => s.ready);
  const showNav = ready.length > 1;

  // Шапка
  const header = document.createElement('header');
  header.className = 'masthead';
  header.innerHTML = `
    <a href="/" aria-label="${SITE.name}, на главную"><div class="wordart">${SITE.name}</div></a>
    <p class="tagline">${SITE.tagline}</p>`;

  // Окно
  const win = document.createElement('div');
  win.className = 'window';
  win.innerHTML = `
    <div class="titlebar">
      <span aria-hidden="true">🖥️</span>
      <span class="t">${WMN.esc(pageTitle)} — ${SITE.domain}</span>
      <span class="tb-btn" aria-hidden="true">_</span>
      <span class="tb-btn" aria-hidden="true">□</span>
      <span class="tb-btn" aria-hidden="true">×</span>
    </div>
    <div class="menubar" aria-hidden="true"><span>Файл</span><span>Правка</span><span>Вид</span><span>Избранное</span><span>Справка</span></div>
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
      <div id="status">Готово</div>
      <div>Интернет</div>
      <div>🔒 https</div>
    </div>`;

  // Футер
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div>Вы посетитель №</div>
    <div class="counter" aria-hidden="true"><b>0</b><b>0</b><b>0</b><b>4</b><b>2</b><b>7</b></div>
    <div class="buttons88" aria-hidden="true">
      <div class="b88 a"><span>СДЕЛАНО</span><span>В БЛОКНОТЕ</span></div>
      <div class="b88 b"><span>HTML</span><span>ручной работы</span></div>
      <div class="b88 c"><span>БЕЗ РЕГИСТРАЦИИ</span><span>И СМС</span></div>
      <div class="b88 d"><span>СМОТРЕТЬ</span><span>В ЛЮБОМ БРАУЗЕРЕ</span></div>
    </div>
    <div>Последнее обновление: ${SITE.updated}</div>`;

  // Переносим контент страницы в окно
  page.parentNode.insertBefore(header, page);
  page.parentNode.insertBefore(win, page);
  win.querySelector('.content').appendChild(page);
  win.after(footer);

  // Бегущая строка, если странице она нужна: <div data-marquee></div>
  document.querySelectorAll('[data-marquee]').forEach(el => {
    el.className = 'marquee'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<span>${WMN.esc(SITE.marquee)}</span>`;
  });
})();
