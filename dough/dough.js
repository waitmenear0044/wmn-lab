/* Калькулятор теста. Рецепты — в dough/recipes.json.
   Пересчёт идёт по площади дна формы: круг — π·r², прямоугольник — a·b. */
(async function () {
  const $ = id => document.getElementById(id);
  let recipes = [];
  try { recipes = await WMN.loadJSON('/dough/recipes.json'); }
  catch (e) { $('basenote').textContent = 'Не удалось загрузить рецепты.'; return; }

  recipes.forEach((r, i) => $('recipe').add(new Option(r.name, i)));

  const area = s => s.shape === 'round' ? Math.PI * (s.d / 2) ** 2 : s.w * s.h;
  const baseLabel = s => s.shape === 'round' ? `круглую форму Ø${s.d} см` : `форму ${s.w}×${s.h} см`;
  const num = v => v.toString().replace('.', ',');

  function fmt(v, unit) {
    if (unit === 'шт')   { const r = Math.round(v * 2) / 2; return num(r < 1 ? 1 : r) + ' шт'; }
    if (unit === 'щеп.') return v < 1.5 ? 'щепотка' : Math.round(v) + ' щеп.';
    const r = v >= 50 ? Math.round(v / 5) * 5 : Math.round(v);
    return r + ' ' + unit;
  }

  function calc() {
    const r = recipes[$('recipe').value];
    const shape = document.querySelector('[name=shape]:checked').value;
    $('roundIn').classList.toggle('hidden', shape !== 'round');
    $('rectIn').classList.toggle('hidden', shape !== 'rect');
    const mine = shape === 'round' ? { shape, d: +$('dia').value || 0 } : { shape, w: +$('w').value || 0, h: +$('h').value || 0 };
    const k = area(mine) / area(r.base);

    $('basenote').textContent = 'Исходный рецепт рассчитан на ' + baseLabel(r.base) + '.';
    if (!k || !isFinite(k)) { $('factor').textContent = 'Введите размеры формы'; $('result').innerHTML = ''; return; }
    $('factor').textContent = k >= 1
      ? 'Ваша форма больше исходной в ' + num(k.toFixed(2)) + ' раза'
      : 'Ваша форма меньше исходной: коэффициент ' + num(k.toFixed(2));
    $('result').innerHTML = r.items.map(([n, v, u]) => `<tr><td>${WMN.esc(n)}</td><td>${fmt(v * k, u)}</td></tr>`).join('');
    $('steps').innerHTML = r.steps.map(s => `<li>${WMN.esc(s)}</li>`).join('');
  }

  ['recipe', 'dia', 'w', 'h'].forEach(id => $(id).addEventListener('input', calc));
  document.querySelectorAll('[name=shape]').forEach(el => el.addEventListener('input', calc));
  calc();
})();
