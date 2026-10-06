/* =========================================================
   Мем-генератор: браузерная копия impact_bot.py
   Логика повторяет бота: те же формулы размера, контура, переносов,
   позиций, шакализатора, вотермарка и коллажа.
   Картинки обрабатываются только в браузере и никуда не отправляются.
   ========================================================= */

const MAX_FILE = 20 * 1024 * 1024;          // 20 МБ
const MAX_SIDE = 2560;                      // как normalize_image() в боте
const SIZE_MIN = 1, SIZE_MAX = 100, SIZE_STEP = 5, SIZE_BASE_FOR_STEP = 20;
const STROKE_MULT = { none: 0, S: 0.5, M: 1, L: 1.7, XL: 2.6 };
const OFFSET_STEP = 3, OFFSET_LIMIT = 45;
const MAX_LAYERS = 5;
const COLLAGE_MIN = 2, COLLAGE_MAX = 6, COLLAGE_WIDTH = 1080, COLLAGE_MAX_HEIGHT = 6000;
const FRY = { 1: [0.45, 10, 2, 1.2], 2: [0.3, 5, 3, 1.5], 3: [0.2, 3, 4, 1.9] };   // масштаб, качество JPEG, проходы, цвет
const WM_SIZES = { S: 0.025, M: 0.035, L: 0.05 };
const FONTS = { impact: 'MemeImpact', lobster: 'MemeLobster' };
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const DEFAULTS = { font: 'impact', size: null, pos: 'original', align: 'center', stretch: 1, stroke: 'M', offset: 0, fry: 0, fryMode: 'image' };

(function () {
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), view = canvas.getContext('2d');
  let phrases = ['мем не завезли'];
  WMN.loadJSON('/bot/phrases.json').then(p => { if (Array.isArray(p) && p.length) phrases = p; }).catch(() => {});

  /* ---------------- Состояние ---------------- */
  const S = { mode: 'single', src: null, panels: null, layers: [], ...DEFAULTS };
  let collage = [];                          // [{ img, url, name }]
  const error = (title, text) => WMN.dialog({ title, icon: '⚠️', html: `<p>${text}</p>` });

  /* ---------------- Вотермарк (запоминается в браузере) ---------------- */
  const WM_KEY = 'wmn-meme-wm';
  let wm = (() => { try { return JSON.parse(localStorage.getItem(WM_KEY)) || {}; } catch (e) { return {}; } })();
  wm = { text: '', enabled: false, mode: 'corner', corner: 'br', size: 'M', transparency: 25, ...wm };
  const saveWm = () => { try { localStorage.setItem(WM_KEY, JSON.stringify(wm)); } catch (e) {} };

  /* =========================================================
     Загрузка картинок
     ========================================================= */
  function checkBlob(blob) {
    if (!blob) return false;
    if (!blob.type || !blob.type.startsWith('image/')) { error('Это не картинка', 'Поддерживаются картинки: JPG, PNG, WebP или GIF.'); return false; }
    if (blob.size > MAX_FILE) { error('Слишком большой файл', `Размер файла ${(blob.size / 1048576).toFixed(1).replace('.', ',')} МБ, а можно не больше 20 МБ.`); return false; }
    return true;
  }
  function loadImage(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => res({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); rej(); };
      img.src = url;
    });
  }
  // как normalize_image(): прозрачное — на белый фон, слишком большое — уменьшаем до 2560
  function normalize(img) {
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  async function acceptBlobs(blobs) {
    blobs = blobs.filter(Boolean);
    if (!blobs.length) return;
    if (S.mode === 'collage') {
      for (const b of blobs) {
        if (collage.length >= COLLAGE_MAX) { error('Максимум фото', `В коллаже максимум ${COLLAGE_MAX} фото, лишние я пропустил.`); break; }
        if (!checkBlob(b)) continue;
        try { const { img, url } = await loadImage(b); collage.push({ img, url, name: b.name || 'фото' }); }
        catch (e) { error('Не получилось открыть', 'Этот формат браузер не понимает. Попробуйте JPG или PNG.'); }
      }
      drawCollageList();
      return;
    }
    const b = blobs[0];
    if (!checkBlob(b)) return;
    try {
      const { img, url } = await loadImage(b);
      setSource(normalize(img), null);
      URL.revokeObjectURL(url);
    } catch (e) { error('Не получилось открыть', 'Этот формат браузер не понимает. Попробуйте сохранить картинку как JPG или PNG.'); }
  }

  // у каждой новой картинки чистый лист — как reset_edit_settings()
  function setSource(src, panels, keepText) {
    S.src = src; S.panels = panels; S.layers = [];
    Object.assign(S, DEFAULTS);
    canvas.width = src.width; canvas.height = src.height;
    $('dropEmpty').classList.add('hidden'); canvas.classList.remove('hidden');
    $('controls').classList.remove('hidden'); $('collageBox').classList.add('hidden');
    if (!keepText) {
      if (!$('text').value.trim()) $('text').value = randomPhrase();
    }
    fryCache = null; syncUI(); render();
    WMN.status('Картинка загружена', 3000);
  }

  $('pickBtn').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', e => { acceptBlobs([...e.target.files]); e.target.value = ''; });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    const files = [...(e.dataTransfer.files || [])];
    if (files.length) acceptBlobs(files);
    else error('Не получилось', 'Перетащите сам файл картинки. Если тащите из другой вкладки, сначала сохраните картинку или скопируйте её.');
  });
  ['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => e.preventDefault()));
  document.addEventListener('paste', e => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const files = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith('image/')).map(i => i.getAsFile());
    if (files.length) { e.preventDefault(); acceptBlobs(files); }
  });
  $('pasteBtn').addEventListener('click', async () => {
    try {
      const out = [];
      for (const it of await navigator.clipboard.read()) {
        const type = it.types.find(t => t.startsWith('image/'));
        if (type) out.push(await it.getType(type));
      }
      if (out.length) return acceptBlobs(out);
      error('В буфере нет картинки', 'Скопируйте картинку (не ссылку на неё) и попробуйте ещё раз.');
    } catch (e) {
      error('Нет доступа к буферу', 'Браузер не дал прочитать буфер обмена. Нажмите <b>Ctrl+V</b> (на Mac — <b>⌘+V</b>) прямо на странице или выберите файл.');
    }
  });

  /* ---------------- Режим: одна картинка / коллаж ---------------- */
  $('modeSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b || b.dataset.v === S.mode) return;
    S.mode = b.dataset.v;
    $('modeSeg').querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', x === b));
    resetAll();
  });
  function resetAll() {
    S.src = null; collage.forEach(c => URL.revokeObjectURL(c.url)); collage = [];
    canvas.classList.add('hidden'); $('dropEmpty').classList.remove('hidden'); $('controls').classList.add('hidden');
    const col = S.mode === 'collage';
    $('file').multiple = col;
    $('dropTitle').innerHTML = col
      ? `<b>Перетащите сюда от ${COLLAGE_MIN} до ${COLLAGE_MAX} фото</b><br>можно все сразу, можно по одному`
      : '<b>Перетащите картинку сюда</b><br>или вставьте из буфера обмена (Ctrl+V)';
    $('collageBox').classList.toggle('hidden', !col);
    drawCollageList();
  }
  function drawCollageList() {
    $('colList').innerHTML = collage.map((c, i) => `
      <li><img src="${c.url}" alt=""><span>Фото ${i + 1}</span>
        <button class="btn98" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Выше">▲</button>
        <button class="btn98" data-down="${i}" ${i < collage.length - 1 ? '' : 'disabled'} aria-label="Ниже">▼</button>
        <button class="btn98" data-del="${i}" aria-label="Убрать">✕</button></li>`).join('');
    $('colBuild').disabled = collage.length < COLLAGE_MIN;
    $('colBuild').textContent = collage.length < COLLAGE_MIN ? `✅ Собрать (нужно минимум ${COLLAGE_MIN})` : `✅ Собрать коллаж (${collage.length} фото)`;
  }
  $('colList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const swap = (a, c) => { [collage[a], collage[c]] = [collage[c], collage[a]]; };
    if (b.dataset.up) swap(+b.dataset.up, +b.dataset.up - 1);
    if (b.dataset.down) swap(+b.dataset.down, +b.dataset.down + 1);
    if (b.dataset.del) { URL.revokeObjectURL(collage[+b.dataset.del].url); collage.splice(+b.dataset.del, 1); }
    drawCollageList();
  });
  $('colClear').addEventListener('click', () => { collage.forEach(c => URL.revokeObjectURL(c.url)); collage = []; drawCollageList(); });

  // как build_collage(): склеиваем сверху вниз
  $('colBuild').addEventListener('click', () => {
    if (collage.length < COLLAGE_MIN) return;
    const imgs = collage.map(c => c.img);
    let width = Math.min(COLLAGE_WIDTH, Math.max(...imgs.map(im => im.naturalWidth)));
    let heights = imgs.map(im => Math.max(1, Math.round(im.naturalHeight * width / im.naturalWidth)));
    let total = heights.reduce((a, b) => a + b, 0);
    if (total > COLLAGE_MAX_HEIGHT) {
      const k = COLLAGE_MAX_HEIGHT / total;
      width = Math.max(1, Math.floor(width * k)); heights = heights.map(h => Math.max(1, Math.floor(h * k)));
      total = heights.reduce((a, b) => a + b, 0);
    }
    const c = document.createElement('canvas'); c.width = width; c.height = total;
    const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, width, total);
    const panels = []; let y = 0;
    imgs.forEach((im, i) => { x.drawImage(im, 0, y, width, heights[i]); panels.push([y, y + heights[i]]); y += heights[i]; });
    $('text').value = '';
    setSource(c, panels, true);
    $('text').placeholder = `Напишите ${panels.length} строки через Enter — каждая встанет внизу своей картинки.`;
    $('text').focus();
  });

  /* =========================================================
     Текст и эмодзи — как rich_draw() / rich_length() в боте
     ========================================================= */
  const seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter() : null;
  const isEmoji = g => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g) || /⃣/.test(g);
  function splitEmoji(text) {
    const parts = []; let buf = '';
    const graphemes = seg ? [...seg.segment(text)].map(x => x.segment) : Array.from(text);
    for (const g of graphemes) {
      if (isEmoji(g)) { if (buf) parts.push(['text', buf]); buf = ''; parts.push(['emoji', g]); }
      else buf += g;
    }
    if (buf) parts.push(['text', buf]);
    return parts;
  }
  const metricsCache = {};
  function metrics(ctx, family, px) {             // где стоят заглавные буквы — чтобы эмодзи были с ними на одной линии
    const key = family + px;
    if (!metricsCache[key]) {
      ctx.font = `${px}px ${family}`;
      const m = ctx.measureText('НЖ');
      const asc = m.fontBoundingBoxAscent ?? px * 0.8;
      const capH = Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
      metricsCache[key] = { asc, capTop: asc - m.actualBoundingBoxAscent, capH, emH: Math.max(1, Math.round(capH * 1.2)) };
    }
    return metricsCache[key];
  }
  function richLength(ctx, text, family, px) {
    const mt = metrics(ctx, family, px); let w = 0;
    for (const [kind, chunk] of splitEmoji(text)) {
      if (kind === 'text') { ctx.font = `${px}px ${family}`; w += ctx.measureText(chunk).width; }
      else { ctx.font = `${mt.emH}px ${EMOJI_FONT}`; w += ctx.measureText(chunk).width + Math.max(1, Math.floor(mt.emH / 12)); }
    }
    return w;
  }
  function richDraw(ctx, x, y, text, family, px, stroke) {
    const mt = metrics(ctx, family, px);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    for (const [kind, chunk] of splitEmoji(text)) {
      if (kind === 'text') {
        ctx.font = `${px}px ${family}`;
        if (stroke > 0) { ctx.lineWidth = stroke * 2; ctx.strokeStyle = '#000'; ctx.strokeText(chunk, x, y + mt.asc); }
        ctx.fillStyle = '#fff'; ctx.fillText(chunk, x, y + mt.asc);
        x += ctx.measureText(chunk).width;
      } else {
        ctx.font = `${mt.emH}px ${EMOJI_FONT}`;
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
        ctx.fillText(chunk, x, y + mt.capTop + mt.capH / 2);
        ctx.textBaseline = 'alphabetic';
        x += ctx.measureText(chunk).width + Math.max(1, Math.floor(mt.emH / 12));
      }
    }
  }

  const sizeToPx = (v, w) => Math.max(10, Math.round(w * (v + 4) / 300));
  const strokeFor = px => Math.max(2, Math.floor(px / 14));

  function wrapByWidth(ctx, text, family, px, maxW) {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = []; let cur = words[0];
    for (const w of words.slice(1)) {
      const cand = cur + ' ' + w;
      if (richLength(ctx, cand, family, px) <= maxW) cur = cand; else { lines.push(cur); cur = w; }
    }
    lines.push(cur);
    return lines;
  }
  function fitText(ctx, texts, family, startPx, minPx, availW, maxH, mult) {
    let px = startPx;
    while (px >= minPx) {
      const stroke = Math.round(strokeFor(px) * mult);
      const lineH = Math.floor(px * 1.1) + stroke;
      const limit = availW - 2 * stroke;
      const wrapped = texts.map(t => wrapByWidth(ctx, t, family, px, limit));
      const all = wrapped.flat();
      const tooWide = all.some(l => richLength(ctx, l, family, px) > limit);
      if (all.length && !tooWide && all.length * lineH <= maxH) return { px, wrapped, stroke, lineH };
      px -= Math.max(2, Math.floor(px / 25));
    }
    return null;
  }
  function chooseFit(ctx, texts, family, size, w, availW, availH, mult, stretch) {
    if (size == null) {                                   // авто: стартуем с 12% ширины, текст ≤ 40% высоты и 80% ширины
      return fitText(ctx, texts, family, Math.max(10, Math.floor(w * 0.12)), Math.max(10, Math.floor(w * 0.04)),
        Math.floor(availW * 0.8), Math.min(availH, Math.floor(availH * 0.4 * stretch)), mult)
        || fitText(ctx, texts, family, Math.max(10, Math.floor(w * 0.04)), 10, availW, availH, mult);
    }
    return fitText(ctx, texts, family, sizeToPx(size, w), 10, availW, availH, mult);
  }

  // одна надпись — порт draw_text_layer()
  function drawTextLayer(target, L, panels) {
    const w = target.width, h = target.height;
    const stretch = L.stretch > 1 ? L.stretch : 1;
    const vh = Math.max(1, Math.round(h / stretch));
    const c = stretch > 1 ? Object.assign(document.createElement('canvas'), { width: w, height: vh }) : target;
    const ctx = c.getContext('2d');
    const padding = Math.max(10, Math.floor(Math.min(w, vh) * 0.03));
    const mult = STROKE_MULT[L.stroke] ?? 1;
    const dy = vh * L.offset / 100;
    const family = FONTS[L.font] || FONTS.impact;
    let texts = L.texts.filter(t => t.trim()); if (!texts.length) texts = [' '];
    const availW = w - 2 * padding, availH = vh - 2 * padding;

    const put = (lines, f, y, area = [0, vh]) => {
      const blockH = lines.length * f.lineH;
      y = Math.min(Math.max(y + dy, area[0]), Math.max(area[0], area[1] - blockH));
      for (const line of lines) {
        const tw = richLength(ctx, line, family, f.px);
        const x = L.align === 'left' ? padding + f.stroke : L.align === 'right' ? w - padding - f.stroke - tw : (w - tw) / 2;
        richDraw(ctx, x, y, line, family, f.px, f.stroke);
        y += f.lineH;
      }
    };

    if (panels && panels.length > 1 && L.pos === 'original' && texts.length >= 2) {
      const vp = panels.map(([a, b]) => [a / stretch, b / stretch]), n = vp.length;
      const groups = texts.length >= n ? [...texts.slice(0, n - 1).map(t => [t]), texts.slice(n - 1)] : texts.map(t => [t]);
      groups.forEach((g, i) => {
        if (!g.length || !vp[i]) return;
        const [y0, y1] = vp[i];
        const f = chooseFit(ctx, g, family, L.size, w, availW, (y1 - y0) - 2 * padding, mult, stretch);
        if (!f) return;
        const lines = f.wrapped.flat();
        put(lines, f, y1 - padding - lines.length * f.lineH, [y0, y1]);
      });
    } else {
      const f = chooseFit(ctx, texts, family, L.size, w, availW, availH, mult, stretch);
      if (f) {
        const all = f.wrapped.flat(), total = all.length * f.lineH;
        if (L.pos === 'top') put(all, f, padding);
        else if (L.pos === 'center') put(all, f, (vh - total) / 2);
        else if (L.pos === 'bottom') put(all, f, vh - padding - total);
        else if (texts.length === 2 && f.wrapped.length === 2) {
          put(f.wrapped[0], f, padding);
          put(f.wrapped[1], f, vh - padding - f.wrapped[1].length * f.lineH);
        } else put(all, f, vh - padding - total);
      }
    }
    if (stretch > 1) target.getContext('2d').drawImage(c, 0, 0, w, h);
  }

  /* =========================================================
     Шакализатор — порт fry_image()
     ========================================================= */
  const jpeg = (c, q) => new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q));
  const blobToImage = b => new Promise((res, rej) => { const u = URL.createObjectURL(b), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = rej; i.src = u; });
  async function fry(src, level) {
    if (!level) return src;
    const [scale, quality, passes, color] = FRY[level] || FRY[3];
    const w = src.width, h = src.height;
    const small = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) });
    small.getContext('2d').drawImage(src, 0, 0, small.width, small.height);
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(small, 0, 0, w, h);
    const id = x.getImageData(0, 0, w, h), d = id.data;
    // цвет (как ImageEnhance.Color)
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      for (let k = 0; k < 3; k++) d[i + k] = g + color * (d[i + k] - g);
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    if (level >= 2) {
      // контраст (как ImageEnhance.Contrast — относительно средней яркости)
      const mean = sum / (d.length / 4), con = 1.2 + 0.2 * (level - 2);
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = mean + con * (d[i + k] - mean);
      // резкость (как ImageEnhance.Sharpness: усиливаем отличие от сглаженной версии)
      const f = 2.0 + level, o = new Uint8ClampedArray(d);
      for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
        const i = (yy * w + xx) * 4;
        for (let k = 0; k < 3; k++) {
          const s = (o[i - 4 * w - 4 + k] + o[i - 4 * w + k] + o[i - 4 * w + 4 + k] + o[i - 4 + k] + 5 * o[i + k] + o[i + 4 + k]
            + o[i + 4 * w - 4 + k] + o[i + 4 * w + k] + o[i + 4 * w + 4 + k]) / 13;
          d[i + k] = s + f * (o[i + k] - s);
        }
      }
    }
    x.putImageData(id, 0, 0);
    let cur = c;
    for (let p = 0; p < passes; p++) {                  // несколько раз пережимаем в JPEG
      const img = await blobToImage(await jpeg(cur, quality / 100));
      const n = Object.assign(document.createElement('canvas'), { width: w, height: h });
      n.getContext('2d').drawImage(img, 0, 0); cur = n;
    }
    return cur;
  }
  let fryCache = null;                                 // шакалить картинку заново при каждой букве незачем

  /* =========================================================
     Вотермарк — порт draw_watermark()
     ========================================================= */
  function wmTile(text, px) {
    const stroke = Math.max(1, Math.floor(px / 12)), probe = document.createElement('canvas').getContext('2d');
    const tw = Math.ceil(richLength(probe, text, FONTS.impact, px)) + 4 * stroke + 4, th = Math.ceil(px * 1.5) + 4 * stroke;
    const t = Object.assign(document.createElement('canvas'), { width: tw, height: th });
    const x = t.getContext('2d'); const mt = metrics(x, FONTS.impact, px);
    let cx = 2 * stroke;
    for (const [kind, chunk] of splitEmoji(text)) {
      x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
      if (kind === 'text') {
        x.font = `${px}px ${FONTS.impact}`;
        x.lineWidth = stroke * 2; x.strokeStyle = 'rgba(0,0,0,.78)'; x.strokeText(chunk, cx, stroke + mt.asc);
        x.fillStyle = '#fff'; x.fillText(chunk, cx, stroke + mt.asc); cx += x.measureText(chunk).width;
      } else {
        x.font = `${mt.emH}px ${EMOJI_FONT}`; x.textBaseline = 'middle'; x.fillText(chunk, cx, stroke + mt.capTop + mt.capH / 2);
        cx += x.measureText(chunk).width + Math.max(1, Math.floor(mt.emH / 12));
      }
    }
    // как tile.crop(tile.getbbox()) — обрезаем пустые края, чтобы шаг сетки совпадал с ботом
    const a = x.getImageData(0, 0, tw, th).data; let x0 = tw, y0 = th, x1 = -1, y1 = -1;
    for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) if (a[(yy * tw + xx) * 4 + 3]) {
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
    }
    if (x1 < 0) return t;
    const cut = Object.assign(document.createElement('canvas'), { width: x1 - x0 + 1, height: y1 - y0 + 1 });
    cut.getContext('2d').drawImage(t, -x0, -y0);
    return cut;
  }
  function drawWatermark(target) {
    const w = target.width, h = target.height;
    const px = Math.max(12, Math.floor(w * (WM_SIZES[wm.size] || WM_SIZES.M)));
    const tile = wmTile(wm.text, px);
    const o = Object.assign(document.createElement('canvas'), { width: w, height: h }), x = o.getContext('2d');
    if (wm.mode === 'grid') {
      const a = 25 * Math.PI / 180, rw = Math.ceil(tile.width * Math.cos(a) + tile.height * Math.sin(a)), rh = Math.ceil(tile.width * Math.sin(a) + tile.height * Math.cos(a));
      const sx = rw + px * 2, sy = rh + px; let row = 0;
      for (let y = -rh + 1; y < h; y += sy, row++) {
        const shift = (sx / 2) * (row % 2);
        for (let xx = -rw + 1 + shift; xx < w; xx += sx) {
          x.save(); x.translate(xx + rw / 2, y + rh / 2); x.rotate(-a); x.drawImage(tile, -tile.width / 2, -tile.height / 2); x.restore();
        }
      }
    } else {
      const pad = Math.max(8, Math.floor(Math.min(w, h) * 0.02));
      const left = wm.corner === 'tl' || wm.corner === 'bl', top = wm.corner === 'tl' || wm.corner === 'tr';
      x.drawImage(tile, Math.max(0, left ? pad : w - pad - tile.width), Math.max(0, top ? pad : h - pad - tile.height));
    }
    const t = target.getContext('2d'); t.save(); t.globalAlpha = (100 - wm.transparency) / 100; t.drawImage(o, 0, 0); t.restore();
  }

  /* =========================================================
     Сборка картинки — порт add_text_to_image()
     ========================================================= */
  const currentLayer = () => ({ texts: $('text').value.split('\n'), font: S.font, size: S.size, pos: S.pos, align: S.align, stretch: S.stretch, stroke: S.stroke, offset: S.offset });
  async function compose() {
    let base = S.src;
    if (S.fry && S.fryMode === 'image') {
      if (!fryCache || fryCache.src !== S.src || fryCache.level !== S.fry) fryCache = { src: S.src, level: S.fry, img: await fry(S.src, S.fry) };
      base = fryCache.img;
    }
    const out = Object.assign(document.createElement('canvas'), { width: S.src.width, height: S.src.height });
    out.getContext('2d').drawImage(base, 0, 0);
    for (const L of [...S.layers, currentLayer()]) drawTextLayer(out, L, S.panels);
    let res = out;
    if (S.fry && S.fryMode !== 'image') res = await fry(out, S.fry);
    if (wm.enabled && wm.text.trim()) drawWatermark(res);
    return res;
  }
  let renderId = 0, raf = 0;
  async function render() {
    if (!S.src) return;
    const id = ++renderId;
    if (S.fry) WMN.status('Шакалю…');
    const res = await compose();
    if (id !== renderId) return;                        // пока считали, пользователь уже что-то поменял
    view.clearRect(0, 0, canvas.width, canvas.height); view.drawImage(res, 0, 0);
    if (S.fry) WMN.status('Готово');
  }
  const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); };

  /* =========================================================
     Управление
     ========================================================= */
  const randomPhrase = () => phrases[Math.floor(Math.random() * phrases.length)];
  $('randomBtn').addEventListener('click', () => { $('text').value = randomPhrase(); soon(); });
  $('text').addEventListener('input', soon);

  // кнопки-переключатели data-key
  document.querySelectorAll('#controls .seg[data-key]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const key = g.dataset.key; let v = b.dataset.v;
    if (key === 'size') v = v === 'auto' ? null : +v;
    else if (key === 'stretch' || key === 'fry') v = +v;
    S[key] = v; syncUI(); soon();
    if (key === 'fry') WMN.status(v ? `Шакализатор: ${v}/3` : 'Оригинал вернул', 3000);
  }));
  const setSize = v => { S.size = v == null ? null : Math.max(SIZE_MIN, Math.min(SIZE_MAX, v)); syncUI(); soon(); };
  $('bigger').addEventListener('click', () => setSize((S.size ?? SIZE_BASE_FOR_STEP) + SIZE_STEP));
  $('smaller').addEventListener('click', () => setSize((S.size ?? SIZE_BASE_FOR_STEP) - SIZE_STEP));
  $('sizeIn').addEventListener('change', e => {
    const v = parseInt(e.target.value, 10);
    if (isNaN(v)) return syncUI();
    if (v > SIZE_MAX || v < SIZE_MIN) WMN.status(`Размер — от ${SIZE_MIN} до ${SIZE_MAX}`, 3000);
    setSize(v);
  });
  document.querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', () => {
    const d = b.dataset.nudge;
    S.offset = d === 'reset' ? 0 : Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, S.offset + (d === 'up' ? -OFFSET_STEP : OFFSET_STEP)));
    syncUI(); soon();
  }));

  // несколько надписей: закрепить / отменить
  const POS_LABELS = { original: 'обычное', top: 'сверху', center: 'по центру', bottom: 'снизу' };
  $('pinBtn').addEventListener('click', () => {
    const cur = $('text').value.split('\n').filter(t => t.trim());
    if (!cur.length) return error('Нечего закреплять', 'Сначала напишите текст — закреплять пока нечего.');
    if (S.layers.length >= MAX_LAYERS) return error('Максимум надписей', `Можно закрепить до ${MAX_LAYERS} надписей.`);
    S.layers.push(currentLayer());
    S.offset = 0;
    const prev = S.pos;                                  // новую надпись ставим туда, где ещё свободно
    S.pos = prev === 'top' ? 'bottom' : prev === 'original' && cur.length === 2 ? 'center' : (prev === 'original' || prev === 'bottom') ? 'top' : 'bottom';
    $('text').value = ''; $('text').focus();
    $('pinNote').textContent = `Надпись закреплена 📌 Напишите следующую — по умолчанию она встанет ${POS_LABELS[S.pos]}. Шрифт, размер и позиция у каждой надписи свои.`;
    syncUI(); soon();
  });
  $('unpinBtn').addEventListener('click', () => {
    const last = S.layers.pop(); if (!last) return;
    $('text').value = last.texts.join('\n');
    Object.assign(S, { font: last.font, size: last.size, pos: last.pos, align: last.align, stretch: last.stretch, stroke: last.stroke, offset: last.offset });
    $('pinNote').textContent = 'Закрепление отменено, эту надпись снова можно менять.';
    syncUI(); soon();
  });

  // вотермарк
  $('wmText').value = wm.text; $('wmOn').checked = wm.enabled;
  $('wmText').addEventListener('input', e => { wm.text = e.target.value.replace(/\n/g, ''); if (wm.text.trim() && !$('wmOn').dataset.touched) { wm.enabled = true; $('wmOn').checked = true; } saveWm(); soon(); });
  $('wmOn').addEventListener('change', e => { e.target.dataset.touched = 1; wm.enabled = e.target.checked; saveWm(); soon(); });
  document.querySelectorAll('[data-wm]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const k = g.dataset.wm; wm[k] = k === 'transparency' ? +b.dataset.v : b.dataset.v;
    saveWm(); syncUI(); soon();
  }));

  // отметить выбранные кнопки
  function syncUI() {
    const mark = (sel, val) => document.querySelectorAll(sel + ' [data-v]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v) === String(val)));
    ['font', 'stretch', 'stroke', 'pos', 'align', 'fry', 'fryMode'].forEach(k => mark(`.seg[data-key="${k}"]`, S[k]));
    mark('.seg[data-key="size"]', S.size == null ? 'auto' : S.size);
    $('sizeNow').textContent = S.size == null ? 'авто' : S.size;
    $('sizeIn').value = S.size ?? '';
    $('nudgeNow').textContent = S.offset === 0 ? '↺ без сдвига' : S.offset < 0 ? `↺ выше на ${-S.offset}%` : `↺ ниже на ${S.offset}%`;
    ['mode', 'corner', 'size', 'transparency'].forEach(k => mark(`.seg[data-wm="${k}"]`, wm[k]));
    $('wmCorners').classList.toggle('hidden', wm.mode !== 'corner');
    const n = S.layers.length;
    $('unpinBtn').classList.toggle('hidden', !n);
    $('unpinBtn').textContent = `↩️ Отменить закрепление (${n})`;
    $('pinBtn').disabled = n >= MAX_LAYERS;
    $('pinNote').classList.toggle('hidden', !n && !$('pinNote').textContent);
  }

  $('resetBtn').addEventListener('click', () => {
    $('text').value = ''; $('pinNote').textContent = '';
    $('text').placeholder = 'Одна строка — текст снизу. Две строки (через Enter) — сверху и снизу. Эмодзи можно 😎';
    resetAll(); drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ---------------- Копировать / Скачать / Стикер ---------------- */
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  $('copyBtn').addEventListener('click', async () => {
    try {
      if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('unsupported');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Promise(res => canvas.toBlob(res, 'image/png')) })]);
      WMN.status('Картинка скопирована: можно вставлять в чат', 4000);
      const b = $('copyBtn'); b.textContent = '✅ Скопировано'; setTimeout(() => b.textContent = '📋 Копировать', 1800);
    } catch (e) {
      error('Не получилось скопировать', 'Этот браузер не умеет копировать картинки. Нажмите «Скачать» или зажмите картинку пальцем / кликните правой кнопкой → «Копировать изображение».');
    }
  });
  $('saveBtn').addEventListener('click', () => canvas.toBlob(b => { download(b, `wmn-meme-${stamp()}.jpg`); WMN.status('Картинка сохранена', 3000); }, 'image/jpeg', 0.92));
  // как make_sticker(): большая сторона ровно 512 px
  $('stickerBtn').addEventListener('click', () => {
    const k = 512 / Math.max(canvas.width, canvas.height);
    const s = Object.assign(document.createElement('canvas'), { width: Math.min(512, Math.max(1, Math.round(canvas.width * k))), height: Math.min(512, Math.max(1, Math.round(canvas.height * k))) });
    const x = s.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, s.width, s.height);
    s.toBlob(b => {
      const webp = b && b.type === 'image/webp';
      download(b, `wmn-sticker-${stamp()}.${webp ? 'webp' : 'png'}`);
      WMN.status('Стикер сохранён: отправьте его боту @Stickers, чтобы добавить в набор', 5000);
    }, 'image/webp', 0.9);
  });

  // шрифты могли ещё не загрузиться — перерисуем, когда загрузятся
  Promise.all(['MemeImpact', 'MemeLobster'].map(f => document.fonts.load(`55px ${f}`, 'Аа'))).then(() => { for (const k in metricsCache) delete metricsCache[k]; soon(); }).catch(() => {});
  resetAll(); syncUI();
})();
