/* =========================================================
   Раздел «Промпты» в виде рабочего стола.
   Ярлыки сфер → окно-проводник (папки по задачам + оглавление) → окно промпта.
   Данные — prompts/prompts.json. Иконки — assets/img/icons/.
   Поле для заполнения в промпте: [подсказка: значение по умолчанию]
   ========================================================= */
(async function () {
  const desk = document.getElementById('desk');
  const PH = /\[([^\]:]+):\s*([^\]]+)\]/g;
  const LANG_KEY = 'wmn-plang';
  let data;
  try { data = await WMN.loadJSON('/prompts/prompts.json'); }
  catch (e) { desk.innerHTML = '<p class="muted">Не удалось загрузить промпты.</p>'; return; }

  const P = data.prompts;
  const byId = Object.fromEntries(P.map(p => [p.id, p]));
  const sph = Object.fromEntries(data.spheres.map(s => [s.id, s]));
  const tsk = Object.fromEntries(data.tasks.map(t => [t.id, t]));
  const esc = WMN.esc;
  const img = (name, cls = '') => `<img class="${cls}" src="${WMN.icon(name)}" alt="" width="32" height="32">`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------------- Рабочий стол ---------------- */
  const PHOTO = { id: 'photo', title: 'Фото и картинки', icon: 'photo' };
  const items = [
    { key: 'readme', title: 'Как пользоваться.txt', icon: 'readme' },
    { key: 'search', title: 'Поиск', icon: 'search' },
    { key: 'photo', title: PHOTO.title, icon: 'photo' },
    ...data.spheres.map(s => ({ key: 'sph:' + s.id, title: s.title, icon: s.id })),
    { key: 'trash', title: 'Корзина', icon: 'trash-full' },
  ];
  desk.innerHTML = items.map(i => `
    <button class="dicon" data-open="${i.key}" role="listitem">${img(i.icon)}<span>${esc(i.title)}</span></button>`).join('');
  desk.addEventListener('click', e => {
    const b = e.target.closest('.dicon'); if (!b) return;
    desk.querySelectorAll('.dicon').forEach(x => x.classList.toggle('sel', x === b));
    open(b.dataset.open);
  });

  function open(key) {
    if (key === 'readme') return readme();
    if (key === 'search') return search();
    if (key === 'trash') return trash();
    if (key === 'photo') return explorer({ id: 'photo', title: PHOTO.title, icon: 'photo', list: P.filter(p => p.format === 'photo'), tags: data.photoTags || [] });
    const id = key.split(':')[1], s = sph[id];
    explorer({ id, title: s.title, icon: id, list: P.filter(p => p.spheres.includes(id)), tags: s.tags || [] });
  }

  /* ---------------- Проводник: папки + оглавление ---------------- */
  function explorer({ id, title, icon, list, tags = [] }) {
    // папки = задачи, в порядке из prompts.json
    const folders = data.tasks.map(t => ({ ...t, items: list.filter(p => p.tasks[0] === t.id) })).filter(f => f.items.length);
    const num = new Map(); let k = 0;
    folders.forEach(f => f.items.forEach(p => num.set(p.id, ++k)));   // сквозная нумерация внутри сферы

    WMN.window({
      id: 'ex-' + id, title, icon: img(icon, 'tb-ico'), width: 620, big: true,
      build(body) {
        let cur = null;                                               // null = корень, иначе id папки
        const draw = () => {
          const f = folders.find(x => x.id === cur);
          const path = `C:\\Промпты\\${title}\\${f ? f.title + '\\' : ''}`;
          const shown = f ? f.items : list;
          body.innerHTML = `
            <div class="ex-bar">
              <button class="btn98" data-back ${f ? '' : 'disabled'}>← Назад</button>
              <div class="ex-addr" title="${esc(path)}">${esc(path)}</div>
            </div>
            ${!f && tags.length ? `<p class="ex-tags">Здесь про: ${tags.slice(0, 14).map(esc).join(', ')}…</p>` : ''}
            ${f ? `
              <div class="ex-icons">${f.items.map(p => fileIcon(p, num.get(p.id))).join('')}</div>
              <h3 class="ex-h">Оглавление папки «${esc(f.title)}»</h3>
              <ol class="toc toc-desc">${f.items.map(p => tocItem(p, num.get(p.id), true)).join('')}</ol>`
            : `
              <div class="ex-icons">${folders.map(x => `
                <button class="dicon light" data-folder="${x.id}">${img('folder')}<span>${esc(x.title)} <em>(${x.items.length})</em></span></button>`).join('')}</div>
              <h3 class="ex-h">Оглавление</h3>
              <div class="toc-wrap">${folders.map(x => `
                <div class="toc-group">
                  <button class="toc-folder" data-folder="${x.id}">${img('folder-open', 'toc-ico')}${esc(x.title)}</button>
                  <ol class="toc">${x.items.map(p => tocItem(p, num.get(p.id))).join('')}</ol>
                </div>`).join('')}</div>`}
            <div class="ex-status">Объектов: ${f ? f.items.length : folders.length} · Промптов в разделе: ${list.length}</div>`;
        };
        body.addEventListener('click', e => {
          const fo = e.target.closest('[data-folder]'); if (fo) { cur = fo.dataset.folder; draw(); body.scrollTop = 0; return; }
          if (e.target.closest('[data-back]')) { cur = null; draw(); return; }
          const pr = e.target.closest('[data-prompt]'); if (pr) openPrompt(pr.dataset.prompt);
        });
        draw();
      },
    });
  }
  const fileIcon = (p, n) => `
    <button class="dicon light" data-prompt="${p.id}">${img(p.format === 'photo' ? 'file-photo' : 'file-text')}<span>${n}. ${esc(p.title)}</span></button>`;
  const tocItem = (p, n, withDesc) => `
    <li value="${n}"><a href="#" data-prompt="${p.id}" onclick="return false">${esc(p.title)}</a>${withDesc ? `<div class="toc-d">${esc(p.desc)}</div>` : ''}</li>`;

  /* ---------------- Окно промпта ---------------- */
  const langPref = () => { try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; } };
  const setLangPref = l => { try { localStorage.setItem(LANG_KEY, l); } catch (e) {} };
  const fieldsOf = text => [...text.matchAll(PH)].map(m => ({ label: m[1].trim(), def: m[2].trim() }));
  const fill = (text, vals) => { let i = 0; return text.replace(PH, (m, a, b) => ((vals[i++] ?? '').trim() || b.trim())); };
  const render = (text, vals) => {
    let i = 0;
    return esc(text).replace(/\[([^\]:]+):\s*([^\]]+)\]/g, (m, a, b) => {
      const v = vals && (vals[i++] ?? '').trim();
      return v ? `<mark class="ph filled">${esc(v)}</mark>` : `<mark class="ph">[${a}: ${b}]</mark>`;
    });
  };

  function openPrompt(id) {
    const p = byId[id]; if (!p) return;
    const langs = Object.keys(p.prompt).filter(l => p.prompt[l]);
    WMN.window({
      id: 'p-' + id, title: p.title, icon: img(p.format === 'photo' ? 'file-photo' : 'file-text', 'tb-ico'), width: 660, big: true,
      build(body) {
        let lang = langs.includes(langPref()) ? langPref() : p.lang;
        let vals = null, formOpen = false;
        const draw = () => {
          const text = p.prompt[lang], fl = fieldsOf(text);
          body.innerHTML = `
            <div class="pw">
              <p class="pw-desc">${esc(p.desc)}</p>
              <div class="pc-tags">${p.tasks.map(x => `<span class="tag">${tsk[x]?.title || x}</span>`).join('')}${p.spheres.map(x => `<span class="tag soft">${img(x, 'tag-ico')}${sph[x]?.title || x}</span>`).join('')}</div>
              ${p.attach ? `<p class="pc-attach">📎 <b>Что прикрепить:</b> ${esc(p.attach)}</p>` : ''}
              ${langs.length > 1 ? `
                <div class="pw-lang"><span>Язык промпта:</span>
                  <div class="seg">${langs.map(l => `<button class="btn98" data-lang="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}${l === p.lang ? ' ★' : ''}</button>`).join('')}</div>
                  <span class="muted">★ — рекомендуем для этой задачи</span></div>` : ''}
              <div class="actions">
                ${fl.length ? `<button class="btn98" data-act="form">${formOpen ? '✏️ Скрыть поля' : '✏️ Заполнить'}</button>` : ''}
                <button class="btn98 big-btn" data-act="copy">📋 Копировать${vals ? ' готовый' : ''}</button>
              </div>
              <div class="pc-form ${formOpen ? '' : 'hidden'}">
                <p class="muted">Поменяйте значения на свои — можно по-русски. Пустое поле оставит пример.</p>
                ${fl.map((f, i) => `<label class="pc-field"><span>${esc(cap(f.label))}</span><input type="text" data-i="${i}" value="${esc(vals ? (vals[i] ?? f.def) : f.def)}"></label>`).join('')}
              </div>
              <pre class="prompt open">${render(text, vals)}</pre>
              ${p.fix?.length ? `<details class="pc-fix"><summary>🛠 Если не получилось</summary><ul>${p.fix.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
              ${p.models?.length ? `<p class="pc-models">Подходит для: ${p.models.join(', ')}</p>` : ''}
            </div>`;
        };
        body.addEventListener('click', async e => {
          const lb = e.target.closest('[data-lang]');
          if (lb) { lang = lb.dataset.lang; setLangPref(lang); draw(); return; }
          const b = e.target.closest('[data-act]'); if (!b) return;
          if (b.dataset.act === 'form') {
            formOpen = !formOpen;
            if (formOpen && !vals) vals = fieldsOf(p.prompt[lang]).map(f => f.def);
            draw(); if (formOpen) body.querySelector('.pc-form input')?.focus(); return;
          }
          if (b.dataset.act === 'copy') {
            await WMN.copy(vals ? fill(p.prompt[lang], vals) : p.prompt[lang]);
            const btn = body.querySelector('[data-act=copy]'); btn.textContent = '✅ Скопировано';
            setTimeout(() => { btn.textContent = '📋 Копировать' + (vals ? ' готовый' : ''); }, 1600);
            WMN.status(vals ? 'Готовый промпт скопирован: вставляйте в нейросеть' : 'Промпт скопирован', 4000);
          }
        });
        body.addEventListener('input', e => {
          const inp = e.target.closest('.pc-form input'); if (!inp) return;
          vals[+inp.dataset.i] = inp.value;
          body.querySelector('pre.prompt').innerHTML = render(p.prompt[lang], vals);
          body.querySelector('[data-act=copy]').textContent = '📋 Копировать готовый';
        });
        draw();
      },
    });
  }

  /* ---------------- Поиск ----------------
     Понимает разные формы слов (ребёнок / ребенку / детям — по общей основе), «ё» = «е».
     Каждое слово запроса должно найтись; выше — совпадения в названии, ниже — в тэгах сферы и тексте промпта. */
  const norm = t => String(t || '').toLowerCase().replace(/ё/g, 'е');
  const stem = w => w.length > 6 ? w.slice(0, -3) : w.length > 4 ? w.slice(0, -2) : w;
  const tagsOf = p => (p.format === 'photo' ? (data.photoTags || []) : []).concat(...p.spheres.map(x => sph[x]?.tags || []));
  const INDEX = P.map(p => ({ p, f: [
    [norm(p.title), 6],
    [norm(p.desc), 3],
    [norm(tagsOf(p).join(' ') + ' ' + p.spheres.map(x => sph[x]?.title).join(' ') + ' ' + p.tasks.map(x => tsk[x]?.title).join(' ')), 2],
    [norm((p.attach || '') + ' ' + (p.prompt.ru || '')), 1],
  ] }));
  function find(q) {
    const words = norm(q).split(/[^a-zа-я0-9]+/).filter(w => w.length > 1).map(stem);
    if (!words.length) return [];
    return INDEX.map(({ p, f }) => {
      let score = 0;
      for (const w of words) {
        const best = Math.max(0, ...f.map(([txt, wt]) => txt.includes(w) ? wt : 0));
        if (!best) return null;                                        // каждое слово должно найтись
        score += best;
      }
      return { p, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(x => x.p);
  }

  function search() {
    WMN.window({
      id: 'search', title: 'Найти: промпты', icon: img('search', 'tb-ico'), width: 520, big: true,
      build(body) {
        const hints = ['резюме', 'тревога', 'старое фото', 'ребёнок', 'кредит', 'начальник', 'переезд', 'выгорание'];
        body.innerHTML = `
          <div class="sr-box"><label for="srq">Искать:</label><input type="text" id="srq" placeholder="опишите задачу своими словами" autocomplete="off"></div>
          <div class="sr-hints">Например: ${hints.map(h => `<button class="chip" data-hint="${h}">${h}</button>`).join('')}</div>
          <div class="sr-res"></div>`;
        const res = body.querySelector('.sr-res'), q = body.querySelector('#srq');
        const run = () => {
          const v = q.value.trim();
          if (v.length < 2) { res.innerHTML = '<p class="muted">Введите хотя бы 2 буквы или нажмите на пример выше.</p>'; return; }
          const found = find(v);
          res.innerHTML = found.length
            ? `<p class="muted">Найдено: ${found.length}</p><ul class="sr-list">${found.map(p => `
                <li><a href="#" data-prompt="${p.id}" onclick="return false">${img(p.format === 'photo' ? 'file-photo' : 'file-text', 'toc-ico')}${esc(p.title)}</a>
                <div class="toc-d">${esc(p.desc)}</div>
                <div class="toc-d">${p.spheres.map(x => sph[x]?.title).join(' · ')}</div></li>`).join('')}</ul>`
            : '<p class="muted">Ничего не нашлось. Попробуйте другое слово или откройте папку нужной сферы.</p>';
        };
        let t = 0; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 150); });
        body.addEventListener('click', e => {
          const h = e.target.closest('[data-hint]'); if (h) { q.value = h.dataset.hint; run(); return; }
          const a = e.target.closest('[data-prompt]'); if (a) openPrompt(a.dataset.prompt);
        });
        run(); setTimeout(() => q.focus(), 50);
      },
    });
  }

  /* ---------------- Как пользоваться.txt ---------------- */
  function readme() {
    WMN.window({
      id: 'readme', title: 'Как пользоваться.txt — Блокнот', icon: img('readme', 'tb-ico'), width: 520, big: true,
      build(body) {
        body.innerHTML = `<div class="notepad">
<b>КАК ПОЛЬЗОВАТЬСЯ ПРОМПТАМИ</b>

1. Откройте папку нужной сферы: «Работа», «Дом», «Фото и картинки»…
   Внутри — папки по задачам и оглавление всех промптов.

2. Откройте промпт и нажмите «✏️ Заполнить».
   Всё, что в <mark class="ph">[квадратных скобках]</mark>, — места для ваших данных.
   Поменяйте значения на свои. Писать можно по-русски: нейросеть поймёт.

3. Нажмите «📋 Копировать» и вставьте промпт в ChatGPT, Claude или Gemini.
   Для фото-промптов не забудьте прикрепить само фото.

4. Не получилось с первого раза? Загляните в «🛠 Если не получилось»:
   там готовые фразы, чтобы поправить результат.

<b>ПРО ЯЗЫК</b>
У многих промптов есть версии RU и EN. Звёздочкой ★ отмечен язык,
который лучше подходит для задачи. Ваш выбор запоминается.
Отвечать нейросеть будет по-русски в любом случае.

<b>ВАЖНО</b>
Нейросети ошибаются и иногда уверенно выдумывают факты.
Цены, законы, правила въезда и всё про здоровье — перепроверяйте.
Не отправляйте в нейросеть номера карт, паспортов и пароли.
</div>`;
      },
    });
  }

  /* ---------------- Корзина: плохие промпты ---------------- */
  const BAD = [
    ['Сделай красиво', 'Нейросеть не знает, что для вас «красиво» и что трогать нельзя. Скажите, что изменить, что сохранить и для чего картинка.', 'retouch'],
    ['Напиши пост', 'Нет темы, площадки, аудитории и примеров вашего стиля — получится безликий текст, каких тысячи.', 't54'],
    ['Составь мне резюме', 'Без вакансии и вашего реального опыта нейросеть начнёт выдумывать достижения.', 't1'],
    ['Объясни квантовую физику', 'Непонятно, для кого и зачем. Объяснение для школьника и для студента-физика — это разные тексты.', 't20'],
    ['Ты лучший эксперт в мире, отвечай только правильно!!!', 'Громкая роль ничего не добавляет. Современным нейросетям важнее контекст и чёткая задача, чем пафос.', null],
    ['Помоги', 'Без комментариев 🙂', null],
  ];
  function trash() {
    WMN.window({
      id: 'trash', title: 'Корзина', icon: img('trash-full', 'tb-ico'), width: 560, big: true,
      build(body) {
        body.innerHTML = `
          <p class="muted">Здесь лежат удалённые промпты. Они не работают, и вот почему.</p>
          <ul class="bad">${BAD.map(([t, why, good]) => `
            <li>${img('file-text', 'toc-ico')}<b>«${esc(t)}»</b>
              <div class="toc-d">${esc(why)}</div>
              ${good ? `<a href="#" data-prompt="${good}" onclick="return false">→ Как сделать хорошо: «${esc(byId[good].title)}»</a>` : ''}</li>`).join('')}</ul>
          <div class="g-toolbar center"><button class="btn98" data-empty>Очистить корзину</button></div>`;
        body.addEventListener('click', e => {
          const a = e.target.closest('[data-prompt]'); if (a) return openPrompt(a.dataset.prompt);
          if (e.target.closest('[data-empty]')) WMN.dialog({ title: 'Корзина', icon: '🗑️', html: '<p>Не получится: плохие промпты бессмертны. Их пишут каждый день.</p>' });
        });
      },
    });
  }
})();
