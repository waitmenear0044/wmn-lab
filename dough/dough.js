/* Калькулятор теста. Рецепты — в dough/recipes.json.
   Два режима:
   • по форме — если у рецепта есть "base" (форма). Пересчёт по площади дна: круг π·r², прямоугольник a·b;
   • по количеству — если есть "yield" (штуки, порции). Пересчёт пропорционально.
   У каждого числового поля есть ползунок (id + "-r"): они синхронизированы. */
(async function () {
  const $ = id => document.getElementById(id);
  let recipes = [];
  try { recipes = await WMN.loadJSON('/dough/recipes.json'); }
  catch (e) { $('meta').textContent = 'Не удалось загрузить рецепты.'; return; }

  /* ---- список рецептов по категориям ---- */
  const sel = $('recipe');
  const groups = {};
  recipes.forEach((r, i) => {
    const cat = r.cat || 'Разное';
    if (!groups[cat]) { groups[cat] = document.createElement('optgroup'); groups[cat].label = cat; sel.appendChild(groups[cat]); }
    groups[cat].appendChild(new Option(r.name, i));
  });

  /* ---- форматирование чисел ---- */
  const comma = x => String(x).replace('.', ',');
  const FR = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };
  function frac(x, step) {                                   // 1.5 → «1½»
    const r = Math.round(x / step) * step || step;
    const whole = Math.floor(r + 1e-9), rest = +(r - whole).toFixed(2);
    return (whole ? whole : '') + (FR[rest] ?? '') || '0';
  }
  function one(v, u) {
    switch (u) {
      case 'г': case 'мл':
        return v < 10 ? comma(Math.max(0.5, Math.round(v * 2) / 2)) : v < 50 ? Math.round(v) : Math.round(v / 5) * 5;
      case 'шт': case 'веточ.': return frac(v, 0.5);
      case 'ч. л.': case 'ст. л.': case 'стак.': return frac(v, 0.25);
      default: return comma(+v.toFixed(1));
    }
  }
  function amount(v, u, k) {
    if (v === null || v === undefined) return '';
    if (u === 'щеп.') {
      const n = (Array.isArray(v) ? v[1] : v) * k;
      return n < 1.5 ? 'щепотка' : Math.round(n) + ' щеп.';
    }
    const txt = Array.isArray(v) ? `${one(v[0] * k, u)}–${one(v[1] * k, u)}` : one(v * k, u);
    return u ? `${txt} ${u}` : txt;
  }
  // «сколько получится»: целые числа, для веса — до десятков
  function hintNum(v, k) {
    const r = x => x >= 100 ? Math.round(x / 10) * 10 : Math.max(1, Math.round(x));
    return Array.isArray(v) ? `${r(v[0] * k)}–${r(v[1] * k)}` : r(v * k);
  }

  /* ---- ползунок + поле ввода ---- */
  /* ---- защита от «сломать калькулятор» ---- */
  const LIMIT = 99;                                           // больше 99 см или 99 штук не бывает
  let scolded = false;
  function guard(num) {
    const v = parseFloat(num.value);
    if (num.value === '' || isNaN(v)) return;
    if (v > LIMIT) {
      num.value = LIMIT;
      if (!scolded) {
        scolded = true;
        WMN.dialog({ title: 'Эээ…', icon: '🤨', html: '<p><b>Друг, зачем тебе столько?</b></p><p class="muted">Поставил 99 — этого точно хватит.</p>',
          buttons: [{ text: 'Понял, убавлю', default: true, action: () => { scolded = false; } }] });
        setTimeout(() => { scolded = false; }, 1500);          // даже если окно закрыли крестиком
      }
    }
    if (v < 0) num.value = Math.abs(v);                       // отрицательные размеры — просто убираем минус
  }

  function bind(id) {
    const num = $(id), rng = $(id + '-r');
    num.max = LIMIT;
    rng.addEventListener('input', () => { num.value = rng.value; num.dispatchEvent(new Event('input')); });
    num.addEventListener('input', () => { guard(num); if (num.value !== '') rng.value = num.value; });
  }
  function setVal(id, v) { $(id).value = v; $(id + '-r').value = v; }
  ['dia', 'w', 'h', 'yieldIn'].forEach(bind);

  /* ---- площадь формы ---- */
  const area = s => s.shape === 'round' ? Math.PI * (s.d / 2) ** 2 : s.w * s.h;
  const baseLabel = s => s.shape === 'round' ? `круглую форму Ø${s.d} см` : `форму ${s.w}×${s.h} см`;

  let lastRecipe = null;
  let formTouched = false;   // пока пользователь не менял форму, подставляем форму из рецепта
  setVal('dia', 24); setVal('w', 30); setVal('h', 20);

  function calc() {
    const r = recipes[sel.value];
    const byForm = !!r.base;
    const switched = lastRecipe !== sel.value; lastRecipe = sel.value;

    $('formBox').classList.toggle('hidden', !byForm);
    $('yieldBox').classList.toggle('hidden', byForm);

    $('about').textContent = r.about || '';
    $('meta').innerHTML = [
      r.time ? `<span>⏱ ${WMN.esc(r.time)}</span>` : '',
      r.out ? `<span>🥣 Выход: ${WMN.esc(r.out)}</span>` : '',
    ].join('');

    let k;
    if (byForm) {
      if (switched && !formTouched) {
        document.querySelector(`[name=shape][value=${r.base.shape}]`).checked = true;
        if (r.base.shape === 'round') setVal('dia', r.base.d); else { setVal('w', r.base.w); setVal('h', r.base.h); }
      }
      const shape = document.querySelector('[name=shape]:checked').value;
      $('roundIn').classList.toggle('hidden', shape !== 'round');
      $('rectIn').classList.toggle('hidden', shape !== 'rect');
      const mine = shape === 'round' ? { shape, d: +$('dia').value || 0 } : { shape, w: +$('w').value || 0, h: +$('h').value || 0 };
      k = area(mine) / area(r.base);
      $('basenote').textContent = 'Исходный рецепт рассчитан на ' + baseLabel(r.base) +
        (r.base.approx ? ' (размер подобран примерно, по количеству теста).' : '.');
    } else {
      if (switched) {
        $('yieldIn-r').max = Math.max(10, r.yield.v * 4);
        setVal('yieldIn', r.yield.v);
      }
      $('yieldLabel').textContent = r.yield.label;
      $('yieldnote').textContent = 'В исходном рецепте: ' + r.yield.v + '.';
      k = (+$('yieldIn').value || 0) / r.yield.v;
    }

    if (!k || !isFinite(k) || k <= 0) {
      $('factor').textContent = byForm ? 'Введите размеры формы' : 'Введите количество';
      $('result').innerHTML = ''; $('hint').textContent = ''; return;
    }
    const kk = comma(k.toFixed(2));
    $('factor').textContent = Math.abs(k - 1) < 0.005 ? 'Как в исходном рецепте'
      : k > 1 ? `Всего нужно больше в ${kk} раза` : `Всего нужно меньше: коэффициент ${kk}`;

    $('hint').textContent = r.hint ? 'Получится: ' + r.hint.f.replace('{n}', hintNum(r.hint.v, k)) : '';

    $('result').innerHTML = r.items.map(it => {
      const main = amount(it.v, it.u, k);
      const alt = it.alt ? `<div class="alt">${WMN.esc(it.alt.t)} ${amount(it.alt.v, it.alt.u, k)}</div>` : '';
      const note = it.note ? `<div class="item-note">${WMN.esc(it.note)}</div>` : '';
      return `<tr><td>${WMN.esc(it.n)}${note}</td><td>${main || '—'}${alt}</td></tr>`;
    }).join('');

    $('steps').innerHTML = r.steps.map(s => `<li>${WMN.esc(s)}</li>`).join('');

    const notes = r.notes || [];
    $('notes').classList.toggle('hidden', !notes.length);
    $('notes').innerHTML = notes.length ? '<b>На заметку</b>' + notes.map(n => `<p>${WMN.esc(n)}</p>`).join('') : '';

    const tips = r.tips || [];
    $('tips').classList.toggle('hidden', !tips.length);
    $('tipsList').innerHTML = tips.map(t => `<li>${WMN.esc(t)}</li>`).join('');
  }

  const touch = () => { formTouched = true; calc(); };
  ['dia', 'w', 'h'].forEach(id => $(id).addEventListener('input', touch));
  document.querySelectorAll('[name=shape]').forEach(el => el.addEventListener('input', touch));
  ['recipe', 'yieldIn'].forEach(id => $(id).addEventListener('input', calc));
  calc();
})();
