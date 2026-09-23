/* =========================================================
   Мем-генератор: браузерная копия impact_bot.py
   Логика отрисовки повторяет бота один в один:
   • картинка приводится к размеру, как у фото в Telegram (длинная сторона до 1280 px);
   • шрифт 55 px ± шаги по 10, автоуменьшение по 2 px, пока текст не влезет;
   • перенос строк как textwrap.wrap в Python;
   • белый текст с чёрной обводкой 2 px;
   • позиции: обычное (1 строка — снизу, 2 строки — сверху и снизу) / сверху / снизу.
   Картинка обрабатывается только в браузере и никуда не отправляется.
   ========================================================= */

const MAX_FILE = 20 * 1024 * 1024;      // 20 МБ
const MAX_SIDE = 1280;                  // как у фото, которые Telegram отдаёт боту
const PADDING = 20, BASE_SIZE = 55, MIN_SIZE = 10, STEP_ADJ = 10;
const FONTS = { impact: 'MemeImpact', lobster: 'MemeLobster' };

(function () {
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const state = { img: null, font: 'impact', pos: 'original', adj: 0 };
  let phrases = ['мем не завезли'];

  WMN.loadJSON('/bot/phrases.json').then(p => { if (Array.isArray(p) && p.length) phrases = p; }).catch(() => {});

  const error = (title, text) => WMN.dialog({ title, icon: '⚠️', html: `<p>${text}</p>` });

  /* =========================================================
     Загрузка картинки: файл, перетаскивание, буфер обмена
     ========================================================= */
  function acceptBlob(blob) {
    if (!blob) return;
    if (!blob.type || !blob.type.startsWith('image/')) {
      return error('Это не картинка', 'Поддерживаются картинки: JPG, PNG, WebP или GIF.');
    }
    if (blob.size > MAX_FILE) {
      return error('Слишком большой файл', `Размер файла ${(blob.size / 1048576).toFixed(1).replace('.', ',')} МБ, а можно не больше 20 МБ.`);
    }
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      state.img = img;
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      $('dropEmpty').classList.add('hidden');
      canvas.classList.remove('hidden');
      $('controls').classList.remove('hidden');
      if (!$('text').value.trim()) randomPhrase();         // как в боте: без подписи — случайная фраза
      render();
      WMN.status('Картинка загружена', 3000);
    };
    img.onerror = () => { URL.revokeObjectURL(url); error('Не получилось открыть', 'Этот формат браузер не понимает. Попробуйте сохранить картинку как JPG или PNG.'); };
    img.src = url;
  }

  $('pickBtn').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', e => { acceptBlob(e.target.files[0]); e.target.value = ''; });

  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) acceptBlob(f);
    else error('Не получилось', 'Перетащите сам файл картинки. Если тащите из другой вкладки, сначала сохраните картинку или скопируйте её.');
  });
  // перетаскивание мимо зоны не должно открывать картинку вместо сайта
  ['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => e.preventDefault()));

  // Ctrl+V в любом месте страницы (кроме поля с подписью)
  document.addEventListener('paste', e => {
    if (e.target.id === 'text') return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); acceptBlob(item.getAsFile()); }
  });
  $('pasteBtn').addEventListener('click', async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find(t => t.startsWith('image/'));
        if (type) return acceptBlob(await it.getType(type));
      }
      error('В буфере нет картинки', 'Скопируйте картинку (не ссылку на неё) и попробуйте ещё раз.');
    } catch (e) {
      error('Нет доступа к буферу', 'Браузер не дал прочитать буфер обмена. Нажмите <b>Ctrl+V</b> (на Mac — <b>⌘+V</b>) прямо на странице, или выберите файл.');
    }
  });

  /* =========================================================
     Отрисовка — порт add_text_to_image() из бота
     ========================================================= */
  // textwrap.wrap(text, width) из Python: слова по пробелам, длинные слова режутся
  function wrap(text, width) {
    width = Math.max(1, width);
    const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = []; let cur = '';
    for (let w of words) {
      while (w.length > width) {
        const room = cur ? width - cur.length - 1 : width;
        if (room <= 0) { lines.push(cur); cur = ''; continue; }
        const part = w.slice(0, room); w = w.slice(room);
        cur = cur ? cur + ' ' + part : part;
        lines.push(cur); cur = '';
      }
      if (!w) continue;
      if (!cur) cur = w;
      else if (cur.length + 1 + w.length <= width) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawOutlined(text, x, y) {
    ctx.fillStyle = '#000';
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) ctx.fillText(text, x + dx, y + dy);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x, y);
  }

  function renderBlock(lines, size, yStart) {
    const lineH = size + 5;
    let y = yStart;
    for (const line of lines) {
      const m = ctx.measureText(line);
      const ascent = m.fontBoundingBoxAscent ?? size * 0.8;     // Pillow рисует от линии верхних выносных
      const tw = (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? m.width);
      const x = (canvas.width - tw) / 2 + (m.actualBoundingBoxLeft ?? 0);
      drawOutlined(line, x, y + ascent);
      y += lineH;
    }
  }

  function currentTexts() {
    // как в боте: подпись режется по переводам строк
    return $('text').value.split('\n');
  }

  function render() {
    if (!state.img) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(state.img, 0, 0, W, H);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    const texts = currentTexts();
    const family = FONTS[state.font];
    let size = BASE_SIZE + state.adj, wrapped = null;
    while (size >= MIN_SIZE) {
      const width = Math.floor((W - 2 * PADDING) / Math.floor(size / 2));
      const w = texts.map(t => wrap(t, width));
      const total = w.reduce((s, l) => s + l.length, 0) * (size + 5);
      if (total <= H - 2 * PADDING) { wrapped = w; break; }
      size -= 2;
    }
    $('sizeInfo').textContent = 'Шрифт: ' + Math.max(size, MIN_SIZE) + ' px';
    if (!wrapped) return;                                        // не влезло даже мелко — картинка без текста, как в боте

    ctx.font = `${size}px ${family}`;
    const lineH = size + 5;
    const all = wrapped.flat();
    const total = all.length * lineH;

    if (state.pos === 'top') renderBlock(all, size, PADDING);
    else if (state.pos === 'bottom') renderBlock(all, size, H - PADDING - total);
    else if (texts.length === 2 && wrapped.length === 2) {
      renderBlock(wrapped[0], size, PADDING);
      renderBlock(wrapped[1], size, H - PADDING - wrapped[1].length * lineH);
    } else renderBlock(all, size, H - PADDING - total);
  }

  // шрифт мог ещё не загрузиться — перерисуем, когда загрузится
  const ensureFont = () => document.fonts.load(`${BASE_SIZE}px ${FONTS[state.font]}`, 'Аа').then(render).catch(render);

  /* =========================================================
     Управление
     ========================================================= */
  function randomPhrase() {
    $('text').value = phrases[Math.floor(Math.random() * phrases.length)];
  }
  $('randomBtn').addEventListener('click', () => { randomPhrase(); render(); });

  let raf = 0;
  $('text').addEventListener('input', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); });

  function seg(id, key, after) {
    $(id).addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      state[key] = b.dataset.v;
      $(id).querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', x === b));
      after ? after() : render();
    });
  }
  seg('fontSeg', 'font', ensureFont);
  seg('posSeg', 'pos');

  $('bigger').addEventListener('click', () => { state.adj += STEP_ADJ; render(); });
  $('smaller').addEventListener('click', () => { if (BASE_SIZE + state.adj - STEP_ADJ >= MIN_SIZE) { state.adj -= STEP_ADJ; render(); } });

  $('resetBtn').addEventListener('click', () => {
    state.img = null; $('text').value = '';
    canvas.classList.add('hidden'); $('controls').classList.add('hidden'); $('dropEmpty').classList.remove('hidden');
    drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ---- Копировать / Скачать ---- */
  const toBlob = () => new Promise(res => canvas.toBlob(res, 'image/png'));

  $('copyBtn').addEventListener('click', async () => {
    try {
      if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('unsupported');
      // Safari требует передать «обещание» картинки сразу, в момент нажатия
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob() })]);
      WMN.status('Картинка скопирована: можно вставлять в чат', 4000);
      const b = $('copyBtn'); b.textContent = '✅ Скопировано'; setTimeout(() => b.textContent = '📋 Копировать', 1800);
    } catch (e) {
      error('Не получилось скопировать', 'Этот браузер не умеет копировать картинки. Нажмите «Скачать» или зажмите картинку пальцем / кликните правой кнопкой → «Копировать изображение».');
    }
  });

  $('saveBtn').addEventListener('click', async () => {
    const blob = await toBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wmn-meme-' + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '') + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    WMN.status('Картинка сохранена', 3000);
  });

  document.fonts.load(`${BASE_SIZE}px MemeImpact`, 'Аа').catch(() => {});
})();
