'use strict';

// ---------- Справочники ----------

// Физическая клавиша (KeyboardEvent.code) -> буква русской раскладки ЙЦУКЕН.
const RU_BY_CODE = {
  Backquote: 'ё',
  KeyQ: 'й', KeyW: 'ц', KeyE: 'у', KeyR: 'к', KeyT: 'е', KeyY: 'н', KeyU: 'г',
  KeyI: 'ш', KeyO: 'щ', KeyP: 'з', BracketLeft: 'х', BracketRight: 'ъ',
  KeyA: 'ф', KeyS: 'ы', KeyD: 'в', KeyF: 'а', KeyG: 'п', KeyH: 'р', KeyJ: 'о',
  KeyK: 'л', KeyL: 'д', Semicolon: 'ж', Quote: 'э',
  KeyZ: 'я', KeyX: 'ч', KeyC: 'с', KeyV: 'м', KeyB: 'и', KeyN: 'т', KeyM: 'ь',
  Comma: 'б', Period: 'ю',
};

const LAYOUTS = {
  ru: {
    name: 'Русская',
    rows: { home: 'фывапролджэ', top: 'йцукенгшщзхъ', bottom: 'ячсмитьбю', extra: 'ё' },
    fromCode: code => RU_BY_CODE[code],
  },
  en: {
    name: 'Латинская',
    rows: { home: 'asdfghjkl', top: 'qwertyuiop', bottom: 'zxcvbnm', extra: '' },
    fromCode: code => (/^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : undefined),
  },
};

const KEY_ROWS = [
  ['Backquote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal','Backspace'],
  ['Tab','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight'],
  ['CapsLock','KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Enter'],
  ['ShiftLeft','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash','ShiftRight'],
  ['Space'],
];
const KEY_LABELS = {
  ru: { Backquote:'ё', Digit1:'1', Digit2:'2', Digit3:'3', Digit4:'4', Digit5:'5', Digit6:'6', Digit7:'7', Digit8:'8', Digit9:'9', Digit0:'0', Minus:'-', Equal:'=', Backspace:'⌫', Tab:'Tab', BracketLeft:'х', BracketRight:'ъ', CapsLock:'Caps', Semicolon:'ж', Quote:'э', Enter:'Enter', ShiftLeft:'Shift', ShiftRight:'Shift', Comma:'б', Period:'ю', Slash:'.', Space:'Пробел' },
  en: { Backquote:'`', Digit1:'1', Digit2:'2', Digit3:'3', Digit4:'4', Digit5:'5', Digit6:'6', Digit7:'7', Digit8:'8', Digit9:'9', Digit0:'0', Minus:'-', Equal:'=', Backspace:'⌫', Tab:'Tab', BracketLeft:'[', BracketRight:']', CapsLock:'Caps', Semicolon:';', Quote:"'", Enter:'Enter', ShiftLeft:'Shift', ShiftRight:'Shift', Comma:',', Period:'.', Slash:'/', Space:'Space' },
};
const SPECIAL_TARGETS = [
  ['Digit0','0'],['Digit1','1'],['Digit2','2'],['Digit3','3'],['Digit4','4'],['Digit5','5'],['Digit6','6'],['Digit7','7'],['Digit8','8'],['Digit9','9'],
  ['Minus','-'],['Equal','='],['BracketLeft','['],['BracketRight',']'],['Semicolon',';'],['Quote',"'"],['Comma',','],['Period','.'],['Slash','/'],
  ['Enter','Enter'],['Backspace','Backspace'],['Tab','Tab'],['CapsLock','Caps Lock'],['ShiftLeft','Shift']
].map(([code,ch]) => ({ code, ch, label: ch }));

const LETTER_SETS = {
  home: { name: 'Основной ряд', chars: r => r.home },
  homeDigits: { name: 'Основной ряд + цифры', chars: r => r.home, targets: () => SPECIAL_TARGETS.filter(t => /^Digit/.test(t.code)) },
  homeTop: { name: 'Основной + верхний ряд', chars: r => r.home + r.top },
  homeBottom: { name: 'Основной + нижний ряд', chars: r => r.home + r.bottom },
  all: { name: 'Все буквы', chars: r => r.home + r.top + r.bottom + r.extra },
  allDigits: { name: 'Все буквы + цифры', chars: r => r.home + r.top + r.bottom + r.extra, targets: () => SPECIAL_TARGETS.filter(t => /^Digit/.test(t.code)) },
  digits: { name: 'Цифры', targets: () => SPECIAL_TARGETS.filter(t => /^Digit/.test(t.code)) },
  symbols: { name: 'Знаки и служебные клавиши', targets: () => SPECIAL_TARGETS.filter(t => !/^Digit/.test(t.code)) },
  allKeys: { name: 'Буквы, цифры и клавиши', chars: r => r.home + r.top + r.bottom + r.extra, includeKeys: true },
};

// fall — сколько секунд буква падает до низа, spawn — интервал появления, мс.
const LEVELS = {
  0: { name: 'Очень лёгкий', fall: 11, spawn: 1800, maxLetters: 2 },
  1: { name: 'Новичок', fall: 9, spawn: 1800 },
  2: { name: 'Лёгкий', fall: 7, spawn: 1300 },
  3: { name: 'Средний', fall: 5, spawn: 950 },
  4: { name: 'Сложный', fall: 3.6, spawn: 700 },
  5: { name: 'Эксперт', fall: 2.6, spawn: 480 },
};

// ---------- Утилиты ----------

const $ = id => document.getElementById(id);

const storage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
  },
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка сервера (${res.status})`);
  return data;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDuration(sec) {
  return sec < 60 ? `${sec} с` : `${Math.round(sec / 60 * 10) / 10} мин`;
}

function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === id);
}

// ---------- Звук ----------

const sound = {
  ctx: null,
  enabled: true,
  init() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },
  tone(freq, start, length, type, volume) {
    const ctx = this.ctx;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  },
  play(kind) {
    if (!this.enabled || !this.ctx) return;
    if (kind === 'hit') {
      this.tone(880, 0, 0.08, 'sine', 0.25);
      this.tone(1320, 0.06, 0.12, 'sine', 0.2);
    } else if (kind === 'error') {
      this.tone(160, 0, 0.22, 'square', 0.12);
      this.tone(120, 0.08, 0.22, 'square', 0.1);
    } else if (kind === 'miss') {
      this.tone(220, 0, 0.18, 'triangle', 0.15);
    }
  },
};

// ---------- Настройки ----------

const settings = storage.get('settings', { user: '', layout: 'ru', level: '2', letters: 'home', duration: '60', sound: true });

function fillSelect(select, options, value) {
  select.innerHTML = Object.entries(options)
    .map(([key, o]) => `<option value="${key}">${escapeHtml(o.name)}</option>`).join('');
  if (value in options) select.value = value;
}

function currentLayout() {
  return document.querySelector('input[name="layout"]:checked').value;
}

function readSettings() {
  return {
    layout: currentLayout(),
    level: $('level').value,
    letters: $('letters').value,
    duration: $('duration').value,
    sound: $('sound').checked,
  };
}

function applySettings() {
  $('user').value = settings.user || '';
  const radio = document.querySelector(`input[name="layout"][value="${settings.layout}"]`);
  if (radio) radio.checked = true;
  fillSelect($('level'), LEVELS, settings.level);
  fillSelect($('letters'), LETTER_SETS, settings.letters);
  $('duration').value = settings.duration;
  $('sound').checked = settings.sound;
}

function describe(s) {
  return [LAYOUTS[s.layout].name, LEVELS[s.level].name, LETTER_SETS[s.letters].name, formatDuration(+s.duration)].join(' · ');
}

const FINGER_NAMES = ['мизинец','безымянный','средний','указательный','большой'];
function fingerFor(code) {
  if (code === 'Space') return 'thumb';
  if (['KeyQ','KeyA','KeyZ','Digit1','Backquote','Tab','CapsLock','ShiftLeft'].includes(code)) return 'left-0';
  if (['KeyW','KeyS','KeyX','Digit2'].includes(code)) return 'left-1';
  if (['KeyE','KeyD','KeyC','Digit3'].includes(code)) return 'left-2';
  if (['KeyR','KeyT','KeyF','KeyG','KeyV','KeyB','Digit4','Digit5'].includes(code)) return 'left-3';
  if (['KeyY','KeyU','KeyH','KeyJ','KeyN','KeyM','Digit6','Digit7'].includes(code)) return 'right-3';
  if (['KeyI','KeyK','Digit8'].includes(code)) return 'right-2';
  if (['KeyO','KeyL','Digit9'].includes(code)) return 'right-1';
  return 'right-0';
}
function makeTargets(layout, set) {
  const config = LETTER_SETS[set];
  const targets = [];
  if (config.chars) {
    const chars = config.chars(LAYOUTS[layout].rows);
    const mapping = layout === 'ru' ? RU_BY_CODE : Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => [`Key${c}`, c.toLowerCase()]));
    for (const [code, ch] of Object.entries(mapping)) if (chars.includes(ch)) targets.push({ code, ch });
  }
  if (config.targets) targets.push(...config.targets());
  if (config.includeKeys) targets.push(...SPECIAL_TARGETS);
  return targets;
}
function keyLabel(layout, code) {
  return LAYOUTS[layout].fromCode(code) || KEY_LABELS[layout][code] || code.slice(3).toLowerCase();
}
function renderGuide() {
  if (!game) return;
  const target = game.letters.reduce((low, l) => (!low || l.y > low.y ? l : low), null);
  const activeCode = target?.code;
  $('target-instruction').textContent = target ? `Нажмите: ${target.ch === ' ' ? 'Пробел' : target.ch.toUpperCase()}` : 'Ждём следующую клавишу';
  const finger = target ? fingerFor(activeCode) : null;
  $('finger-instruction').textContent = target ? `Палец: ${finger.startsWith('left') ? 'левая рука, ' : 'правая рука, '}${FINGER_NAMES[+(finger.split('-')[1])]}` : '';
  $('hands').innerHTML = ['left','right'].map(side => {
    const order = side === 'left' ? [0,1,2,3,4] : [4,3,2,1,0];
    return `<div class="hand ${side}"><span class="hand-label">${side === 'left' ? 'Левая рука' : 'Правая рука'}</span><div class="fingers">${order.map(i => `<span class="finger" data-finger="${side}-${i}" ${finger === `${side}-${i}` || (finger === 'thumb' && i === 4) ? 'data-active="true"' : ''} title="${FINGER_NAMES[i]}"><i></i>${FINGER_NAMES[i]}</span>`).join('')}</div></div>`;
  }).join('');
  if (!$('virtual-keyboard').dataset.layout || $('virtual-keyboard').dataset.layout !== game.settings.layout) {
    $('virtual-keyboard').dataset.layout = game.settings.layout;
    $('virtual-keyboard').innerHTML = KEY_ROWS.map(row => `<div class="key-row">${row.map(code => `<span class="key ${['Backspace','Tab','CapsLock','Enter','ShiftLeft','ShiftRight','Space'].includes(code) ? 'wide' : ''}" data-code="${code}" data-finger="${fingerFor(code)}" title="${escapeHtml(fingerName(code))}">${escapeHtml(keyLabel(game.settings.layout, code))}</span>`).join('')}</div>`).join('');
  }
  for (const key of $('virtual-keyboard').querySelectorAll('.key')) key.classList.toggle('active', key.dataset.code === activeCode);
}
function fingerName(code) {
  if (code === 'Space') return 'Большой палец';
  const finger = fingerFor(code);
  const [side, index] = finger.split('-');
  return `${side === 'left' ? 'Левая рука' : 'Правая рука'}, ${FINGER_NAMES[+index]}`;
}

// ---------- История ----------

let history = [];

async function loadUsers() {
  try {
    const users = await api('/api/users');
    $('users').innerHTML = users.map(u => `<option value="${escapeHtml(u)}">`).join('');
  } catch { /* список пользователей — только подсказка */ }
}

async function loadHistory() {
  const user = $('user').value.trim();
  $('history-user').textContent = user ? `— ${user}` : '';
  $('clear-history').hidden = true;
  if (!user) {
    history = [];
    $('history').innerHTML = '<p class="muted">Введите имя, чтобы увидеть сохранённые результаты.</p>';
    return;
  }
  try {
    history = await api(`/api/results?user=${encodeURIComponent(user)}`);
  } catch (e) {
    $('history').innerHTML = `<p class="bad">${escapeHtml(e.message)}</p>`;
    return;
  }
  renderHistory();
}

function renderHistory() {
  if (!history.length) {
    $('history').innerHTML = '<p class="muted">Пока нет сохранённых результатов.</p>';
    return;
  }
  $('clear-history').hidden = false;
  const rows = history.map(r => `
    <tr>
      <td>${new Date(r.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td>${escapeHtml(LAYOUTS[r.layout]?.name ?? r.layout)}</td>
      <td>${escapeHtml(LEVELS[r.level]?.name ?? r.level)}</td>
      <td>${escapeHtml(LETTER_SETS[r.letters]?.name ?? r.letters)}</td>
      <td class="num">${formatDuration(r.elapsed)}</td>
      <td class="num good">${r.hits}</td>
      <td class="num bad">${r.errors}</td>
      <td class="num bad">${r.misses}</td>
      <td class="num">${r.accuracy}%</td>
      <td class="num"><b>${r.cpm}</b></td>
    </tr>`).join('');
  $('history').innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Дата</th><th>Раскладка</th><th>Уровень</th><th>Буквы</th><th class="num">Время</th>
        <th class="num">Верно</th><th class="num">Ошибки</th><th class="num">Пропущено</th>
        <th class="num">Точность</th><th class="num">Зн/мин</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function bestFor(s) {
  return history
    .filter(r => r.layout === s.layout && String(r.level) === s.level && r.letters === s.letters && String(r.duration) === s.duration)
    .reduce((best, r) => (!best || r.cpm > best.cpm ? r : best), null);
}

// ---------- Игра ----------

const field = $('field');
let game = null;

function startGame() {
  const s = readSettings();
  const layout = LAYOUTS[s.layout];
  game = {
    settings: s,
    layout,
    targets: makeTargets(s.layout, s.letters),
    level: LEVELS[s.level],
    duration: +s.duration,
    elapsed: 0,
    sinceSpawn: Infinity,
    hits: 0, errors: 0, misses: 0,
    letters: [],
    lastX: -1,
    state: 'countdown',
    lastFrame: 0,
    raf: 0,
  };
  sound.enabled = s.sound;
  sound.init();
  for (const el of field.querySelectorAll('.letter')) el.remove();
  $('hud-info').textContent = describe(s);
  updateHud();
  renderGuide();
  showScreen('game');
  countdown(3);
}

function countdown(n) {
  const el = $('countdown');
  el.hidden = false;
  el.textContent = n;
  if (n === 0) {
    el.hidden = true;
    game.state = 'running';
    game.lastFrame = performance.now();
    game.raf = requestAnimationFrame(frame);
    return;
  }
  game.countdownTimer = setTimeout(() => game && countdown(n - 1), 700);
}

function spawnLetter() {
  const g = game;
  const width = field.clientWidth;
  const margin = 40;
  let x;
  for (let i = 0; i < 6; i++) {
    x = margin + Math.random() * (width - margin * 2);
    if (Math.abs(x - g.lastX) > 70) break;
  }
  g.lastX = x;

  let target;
  do target = g.targets[Math.floor(Math.random() * g.targets.length)];
  while (g.targets.length > 1 && g.letters.length && target.code === g.letters[g.letters.length - 1].code);

  const el = document.createElement('div');
  el.className = 'letter';
  el.textContent = target.label || (target.ch === ' ' ? 'Пробел' : target.ch.toUpperCase());
  if (target.label && target.label.length > 1) el.classList.add('service-letter');
  el.style.left = `${x}px`;
  field.appendChild(el);
  g.letters.push({ ...target, el, y: -56 });
  renderGuide();
}

function frame(now) {
  const g = game;
  if (!g || g.state !== 'running') return;
  const dt = Math.min((now - g.lastFrame) / 1000, 0.1);
  g.lastFrame = now;
  g.elapsed += dt;

  const height = field.clientHeight;
  const floor = height - 56;
  const speed = (height + 56) / g.level.fall;

  g.sinceSpawn += dt * 1000;
  if (g.sinceSpawn >= g.level.spawn && g.letters.length < (g.level.maxLetters ?? Infinity)) {
    g.sinceSpawn = 0;
    spawnLetter();
  }

  for (const l of [...g.letters]) {
    l.y += speed * dt;
    if (l.y >= floor) {
      removeLetter(l, 'missed');
      renderGuide();
      g.misses++;
      sound.play('miss');
    } else {
      l.el.style.transform = `translateY(${l.y}px)`;
    }
  }

  updateHud();
  if (g.elapsed >= g.duration) {
    endGame();
    return;
  }
  g.raf = requestAnimationFrame(frame);
}

function removeLetter(l, cls) {
  game.letters.splice(game.letters.indexOf(l), 1);
  l.el.classList.add(cls);
  renderGuide();
  setTimeout(() => l.el.remove(), 400);
}

function updateHud() {
  const g = game;
  $('hud-time').textContent = Math.max(0, Math.ceil(g.duration - g.elapsed));
  $('hud-hits').textContent = g.hits;
  $('hud-errors').textContent = g.errors;
  $('hud-misses').textContent = g.misses;
}

function setPaused(paused) {
  const g = game;
  if (!g || (g.state !== 'running' && g.state !== 'paused')) return;
  if (paused && g.state === 'running') {
    g.state = 'paused';
    cancelAnimationFrame(g.raf);
    $('pause').hidden = false;
  } else if (!paused && g.state === 'paused') {
    g.state = 'running';
    $('pause').hidden = true;
    g.lastFrame = performance.now();
    g.raf = requestAnimationFrame(frame);
  }
}

function flashError() {
  field.classList.remove('flash');
  void field.offsetWidth;
  field.classList.add('flash');
  setTimeout(() => field.classList.remove('flash'), 150);
}

function onKey(e) {
  const g = game;
  if (!g || !$('game').classList.contains('active')) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (e.code === 'Escape') {
    e.preventDefault();
    endGame();
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    setPaused(g.state === 'running');
    return;
  }
  if (g.state !== 'running' || e.repeat) return;

  // Сначала физическая клавиша — тогда системную раскладку переключать не нужно.
  if (!g.targets.some(t => t.code === e.code)) return;
  e.preventDefault();

  // Если одинаковых букв несколько, засчитываем ту, что ниже всех.
  const target = g.letters
    .filter(l => l.code === e.code)
    .reduce((low, l) => (!low || l.y > low.y ? l : low), null);

  if (target) {
    g.hits++;
    removeLetter(target, 'hit');
    sound.play('hit');
  } else {
    g.errors++;
    sound.play('error');
    flashError();
  }
  updateHud();
  renderGuide();
}

function stats(g) {
  const elapsed = Math.max(1, Math.round(g.elapsed));
  const total = g.hits + g.errors + g.misses;
  return {
    elapsed,
    hits: g.hits,
    errors: g.errors,
    misses: g.misses,
    accuracy: total ? Math.round(g.hits / total * 100) : 0,
    cpm: Math.round(g.hits / elapsed * 60),
  };
}

function endGame() {
  const g = game;
  if (!g || g.state === 'over') return;
  clearTimeout(g.countdownTimer);
  cancelAnimationFrame(g.raf);
  g.state = 'over';
  $('countdown').hidden = true;
  $('pause').hidden = true;
  showResult();
}

// ---------- Результат ----------

function showResult() {
  const g = game;
  const st = stats(g);
  g.result = st;
  $('result-info').textContent = describe(g.settings);
  $('result-stats').innerHTML = [
    [st.cpm, 'знаков в минуту'],
    [`${st.accuracy}%`, 'точность'],
    [st.hits, 'верно'],
    [st.errors, 'ошибки'],
    [st.misses, 'пропущено'],
    [formatDuration(st.elapsed), 'время'],
  ].map(([v, label]) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`).join('');

  const best = bestFor(g.settings);
  $('result-best').textContent = best
    ? (st.cpm > best.cpm ? `Новый рекорд! Прежний лучший результат — ${best.cpm} зн/мин.` : `Ваш лучший результат с этими настройками — ${best.cpm} зн/мин.`)
    : '';
  $('save').disabled = false;
  $('save').textContent = 'Сохранить результат';
  $('save-status').textContent = '';
  $('result-user').value = $('user').value.trim() || settings.user;
  showScreen('result');
}

async function saveResult() {
  const g = game;
  const btn = $('save');
  const user = $('result-user').value.trim();
  if (!user) {
    $('result-user').focus();
    $('save-status').className = 'bad';
    $('save-status').textContent = 'Введите имя, под которым сохранить результат.';
    return;
  }
  btn.disabled = true;
  $('save-status').className = 'good';
  $('save-status').textContent = 'Сохраняю…';
  try {
    await api('/api/results', {
      method: 'POST',
      body: {
        user,
        layout: g.settings.layout,
        level: +g.settings.level,
        letters: g.settings.letters,
        duration: g.duration,
        elapsed: g.result.elapsed,
        hits: g.hits,
        errors: g.errors,
        misses: g.misses,
      },
    });
    btn.textContent = 'Сохранено';
    $('save-status').textContent = 'Результат сохранён.';
    settings.user = user;
    storage.set('settings', settings);
    $('user').value = user;
    g.settings.user = user;
    loadUsers();
    loadHistory();
  } catch (e) {
    btn.disabled = false;
    $('save-status').className = 'bad';
    $('save-status').textContent = e.message;
  }
}

function toMenu() {
  game = null;
  for (const el of field.querySelectorAll('.letter')) el.remove();
  showScreen('setup');
  loadHistory();
}

// ---------- Подписки ----------

function persistSettings() {
  Object.assign(settings, readSettings());
  storage.set('settings', settings);
}

$('settings-form').addEventListener('submit', e => {
  e.preventDefault();
  persistSettings();
});

$('settings-toggle').addEventListener('click', () => {
  const form = $('settings-form');
  form.hidden = !form.hidden;
  $('settings-toggle').setAttribute('aria-expanded', String(!form.hidden));
});

$('start').addEventListener('click', () => {
  persistSettings();
  startGame();
});

let userTimer;
$('user').addEventListener('input', () => {
  clearTimeout(userTimer);
  userTimer = setTimeout(loadHistory, 400);
});

$('clear-history').addEventListener('click', async () => {
  const user = $('user').value.trim();
  if (!user || !confirm(`Удалить все результаты пользователя «${user}»?`)) return;
  try {
    await api(`/api/results?user=${encodeURIComponent(user)}`, { method: 'DELETE' });
  } catch (e) {
    alert(e.message);
  }
  loadUsers();
  loadHistory();
});

$('save').addEventListener('click', saveResult);
$('again').addEventListener('click', startGame);
$('menu').addEventListener('click', toMenu);

document.addEventListener('keydown', onKey);
window.addEventListener('blur', () => setPaused(true));
document.addEventListener('visibilitychange', () => document.hidden && setPaused(true));

applySettings();
loadUsers();
loadHistory();
