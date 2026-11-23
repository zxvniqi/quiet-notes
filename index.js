/* Quiet Notes — no network requests; presentation preferences only. */
(() => {
  'use strict';
  const document = window.document;
  const ID = 'qn-settings';
  const KEY = 'quiet-notes.extension.v2';
  const VERSION = '1.0.11';
  if (document.getElementById(ID)) return;
  const flags = {
    enabled: false, top: false, compose: false, avatars: false, media: false, embeds: true, names: false, meta: true, actions: true,
    reader: false, readerTop: false, readerCompose: false, readerTools: false,
    // Typography is the theme's (and Font Manager's) unless these are switched on.
    noteType: false, readerType: false, readerIndent: true,
  };
  // Look customisation. Stored per device with the mode flags.
  const looks = {
    titleNote: { value: '메모', max: 20 }, titleReader: { value: '서재', max: 20 },
    nameBot: { value: '메모', max: 12 }, nameUser: { value: '작성', max: 12 },
    toast: { value: 'top', options: ['top', 'bottom'] },
    noteColor: { value: 'white', options: ['white', 'gray', 'dark'] },
    noteFont: { value: '', font: true },
    uiSize: { value: 100, min: 80, max: 130, step: 5 },
    noteSize: { value: 16, min: 12, max: 22, step: 1 }, noteLine: { value: 1.7, min: 1.3, max: 2.2, step: 0.05 },
    notePara: { value: 1, min: 0, max: 2, step: 0.1 },
    noteDivider: { value: 'line', options: ['line', 'short', 'stars', 'none'] },
    paper: { value: 'paper', options: ['paper', 'white', 'sepia', 'gray', 'night'] },
    readerFont: { value: '', font: true },
    readerSize: { value: 15, min: 12, max: 22, step: 1 }, readerLine: { value: 1.7, min: 1.3, max: 2.2, step: 0.05 },
    readerPara: { value: 0.6, min: 0, max: 2, step: 0.1 }, readerMargin: { value: 22, min: 8, max: 56, step: 2 },
    readerAlign: { value: 'justify', options: ['justify', 'left'] },
    readerDivider: { value: 'stars', options: ['line', 'short', 'stars', 'none'] },
  };
  const fontName = /^[^;{}<>\\]{0,80}$/;
  let state = { ...flags };
  for (const [key, spec] of Object.entries(looks)) state[key] = spec.value;
  // Message menu choices per mode: button key → 'in' (inside ···) or 'out' (in the row). Every choice the user makes is kept.
  const menus = ['menuNote', 'menuReader'];
  for (const key of menus) state[key] = {};
  function validMenu(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([k, v]) => /^[\w-]{1,80}$/.test(k) && (v === 'in' || v === 'out')).slice(0, 200));
  }
  function valid(key, value) {
    const spec = looks[key];
    if (spec.font) return typeof value === 'string' && fontName.test(value);
    if (spec.options) return spec.options.includes(value);
    if (typeof spec.value === 'number') return typeof value === 'number' && value >= spec.min && value <= spec.max;
    return typeof value === 'string' && value.length <= spec.max;
  }
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    for (const key of Object.keys(flags)) if (typeof saved[key] === 'boolean') state[key] = saved[key];
    for (const key of Object.keys(looks)) if (valid(key, saved[key])) state[key] = saved[key];
    for (const key of menus) state[key] = validMenu(saved[key]);
    // Before 2.9.3 'left' was the default (not a choice); books now start justified.
    if (!saved.v) state.readerAlign = looks.readerAlign.value;
  } catch { /* Storage may be unavailable in private browsing. */ }
  // Apply the saved mode as soon as this module loads, before constructing controls.
  document.documentElement.classList.toggle('qn-active', state.enabled);

  function boot() {
    if (document.getElementById(ID)) return;
    const root = document.documentElement;
    const abort = new AbortController();
    const chat = document.getElementById('chat');
    function el(tag, props = {}, ...children) {
      const node = Object.assign(document.createElement(tag), props);
      node.append(...children);
      return node;
    }
    function button(text, handler, className = '') {
      const item = el('button', { type: 'button', textContent: text, className });
      item.addEventListener('click', handler);
      return item;
    }
    const toggleMode = () => { state.enabled = !state.enabled; apply(); };
    // A browser may keep an older stylesheet after an update; reload it once when its version tag differs.
    const styleLink = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => /\/quiet-notes[^/]*\/style\.css$/.test(link.getAttribute('href') || ''));
    function refreshStyle() {
      if (getComputedStyle(root).getPropertyValue('--qn-css').replace(/["'\s]/g, '') === VERSION) return;
      const fresh = styleLink.cloneNode();
      fresh.href = styleLink.getAttribute('href') + '?v=' + VERSION;
      fresh.addEventListener('load', () => styleLink.remove(), {once: true});
      styleLink.after(fresh);
    }
    if (styleLink?.sheet) refreshStyle(); else styleLink?.addEventListener('load', refreshStyle, {once: true});
    // ST sends no cache headers, so a phone can keep running old files for hours after an update.
    // When manifest.json names a new version, the extension's own files are fetched again into the
    // browser cache (same origin, in the background); the next page load then runs them.
    if (styleLink) (async () => {
      try {
        const base = new URL('./', styleLink.href);
        const manifest = await (await fetch(new URL('manifest.json', base), { cache: 'no-cache' })).json();
        if (window.localStorage.getItem(KEY + '.files') === manifest.version) return;
        await Promise.all(['index.js', 'style.css', 'icons.css'].map(file => fetch(new URL(file, base), { cache: 'reload' })));
        window.localStorage.setItem(KEY + '.files', manifest.version);
      } catch { /* The cache refreshes on its own later. */ }
    })();

    // ── Settings: one body, shown in the Extensions tab drawer or moved into the dialog. ──
    // A switch for the mode, then tabs; every control writes state and calls apply().
    const settingsBody = el('div', { className: 'qn-settings-body' });
    const syncers = [];
    const labels = {
      top: '위', bottom: '아래', white: '흰색', gray: '회색', dark: '어둡게', line: '선', short: '짧은 선', stars: '* * *', none: '없음',
      paper: '미색', sepia: '베이지', night: '야간', left: '왼쪽', justify: '양쪽',
    };
    const swatches = {
      white: '#ffffff', gray: '#eaecef', dark: '#22262b',
      paper: '#f8f6f1', sepia: '#f2ede4', night: '#1c1c1e',
    };
    const darkSwatches = new Set(['dark', 'night']);
    // A switch made of plain spans: themes restyle checkboxes, never these.
    function makeSwitch(onChange) {
      const node = el('span', { className: 'qn-switch', tabIndex: 0 }, el('i'));
      node.setAttribute('role', 'switch');
      const flip = () => { if (node.getAttribute('aria-disabled') !== 'true') onChange(node.getAttribute('aria-checked') !== 'true'); };
      node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
      return {
        node, flip,
        set(checked, disabled = false) { node.setAttribute('aria-checked', String(checked)); node.setAttribute('aria-disabled', String(disabled)); },
      };
    }
    function switchRow(text, sw, className = '') {
      const line = el('div', { className: 'qn-row qn-row-switch ' + className }, el('span', { className: 'qn-row-label', textContent: text }), sw.node);
      line.addEventListener('click', sw.flip);
      return line;
    }
    const fontLabels = { '': '기존 그대로', serif: '명조 계열', 'sans-serif': '고딕 계열' };
    function fillFonts(select, current) {
      const names = new Set(['', 'serif', 'sans-serif']);
      try {
        for (const face of document.fonts) {
          const name = face.family.replace(/^["']|["']$/g, '');
          if (fontName.test(name) && !/awesome|icon|symbol|emoji/i.test(name)) names.add(name);
        }
      } catch { /* FontFaceSet iteration is optional. */ }
      names.add(current);
      select.replaceChildren(...[...names].map(name => new Option(fontLabels[name] ?? name, name)));
      select.value = current;
    }
    const set = (key, value) => { state[key] = value; apply(); };
    const row = (text, control, hint) => el('div', { className: 'qn-row' }, el('span', { className: 'qn-row-label', textContent: text }, ...(hint ? [el('small', { textContent: hint })] : [])), control);
    // hide: the switch reads "○○ 가리기", so on means the item is hidden (state stores "shown").
    function toggle(key, text, { forcedInReader = false, hide = false } = {}) {
      const sw = makeSwitch(checked => set(key, hide ? !checked : checked));
      const line = switchRow(text, sw);
      syncers.push(() => {
        // The e-book always hides these: shown as switched on and locked.
        const forced = forcedInReader && state.enabled && state.reader;
        sw.set(forced ? hide : (hide ? !state[key] : state[key]), forced);
      });
      return line;
    }
    function choice(key, { swatch = false } = {}) {
      const box = el('div', { className: swatch ? 'qn-swatches' : 'qn-segments', role: 'radiogroup' });
      const items = looks[key].options.map(value => {
        const item = button(swatch ? '' : labels[value], () => set(key, value));
        item.setAttribute('role', 'radio');
        if (swatch) { item.style.setProperty('--qn-swatch', swatches[value]); item.style.setProperty('--qn-check', darkSwatches.has(value) ? '#fff' : '#333'); item.title = labels[value]; item.setAttribute('aria-label', labels[value]); }
        return [value, item];
      });
      box.append(...items.map(([, item]) => item));
      syncers.push(() => { for (const [value, item] of items) item.setAttribute('aria-checked', String(state[key] === value)); });
      return box;
    }
    function stepper(key, unit = '', typedBy = null) {
      const spec = looks[key];
      const decimals = String(spec.step).split('.')[1]?.length || 0;
      const out = el('output');
      const nudge = dir => set(key, Math.min(spec.max, Math.max(spec.min, Number((state[key] + dir * spec.step).toFixed(decimals)))));
      const minus = button('−', () => nudge(-1));
      const plus = button('+', () => nudge(1));
      for (const [b, label] of [[minus, '줄이기'], [plus, '늘리기']]) b.setAttribute('aria-label', label);
      const box = el('div', { className: 'qn-stepper' }, minus, out, plus);
      syncers.push(() => {
        out.textContent = state[key].toFixed(decimals) + unit;
        minus.disabled = state[key] <= spec.min;
        plus.disabled = state[key] >= spec.max;
        if (typedBy) box.parentElement.hidden = !state[typedBy];
      });
      return box;
    }
    function fontPicker(key) {
      const select = el('select', { className: 'text_pole' });
      select.addEventListener('change', () => set(key, select.value));
      syncers.push(() => { if (select !== document.activeElement) fillFonts(select, state[key]); });
      return select;
    }
    function text(key) {
      // Name fields left empty keep the real names; titles fall back to their defaults.
      const input = el('input', { type: 'text', className: 'text_pole', maxLength: looks[key].max, placeholder: /^name/.test(key) ? '기존 이름' : looks[key].value });
      input.addEventListener('input', () => set(key, input.value.trim().slice(0, looks[key].max)));
      syncers.push(() => { if (input !== document.activeElement) input.value = state[key]; });
      return input;
    }

    const modeSwitch = makeSwitch(checked => { if (checked !== state.enabled) toggleMode(); });
    const modeRow = switchRow('', modeSwitch, 'qn-mode-row');
    const modeLabel = modeRow.firstElementChild;
    settingsBody.append(modeRow);
    syncers.push(() => { modeSwitch.set(state.enabled); modeLabel.textContent = state.enabled ? '일코 모드 켜짐' : '일코 모드 꺼짐'; });

    // ── Message menu: which buttons stay in the row and which wait behind "···", for each mode.
    //    Buttons are never moved: each only gets a data-qn-menu mark, and the stylesheet hides the
    //    "in" ones until ··· opens the row. The page order stays as ST and other extensions made it,
    //    so menu arrangers that read it (e.g. a layout manager) see no change. ──
    const plainClass = /^(mes_button|interactable|menu_button|fa|fa-fw|fa-solid|fa-regular|fa-brands|fa-[\w-]+)$/;
    const buttonKey = node => [...node.classList].find(name => !plainClass.test(name)) || node.id || '';
    const origin = new WeakMap(); // button → 'in' | 'out': inside ST's ··· box or in the row
    const keyDefault = new Map(); // key → where ST or its extension puts it
    const keyLook = new Map(); // key → { label, icon } for the settings list
    function rowParts(row) {
      return { hint: row.querySelector(':scope > .extraMesButtonsHint'), box: row.querySelector(':scope > .extraMesButtons') };
    }
    function noteButtons(row) {
      const { hint, box } = rowParts(row);
      if (!hint || !box) return [];
      const nodes = [...row.children, ...box.children].filter(node => node !== hint && node !== box && buttonKey(node));
      for (const node of nodes) {
        const key = buttonKey(node);
        if (!origin.has(node)) origin.set(node, node.parentElement === box ? 'in' : 'out');
        if (!keyDefault.has(key)) keyDefault.set(key, origin.get(node));
        if (!keyLook.has(key)) {
          const icon = [...node.classList].filter(name => /^fa-/.test(name) && !/^fa-(fw|solid|regular|brands)$/.test(name)).join(' ')
            || [...(node.querySelector('[class*="fa-"]')?.classList || [])].filter(name => /^fa-/.test(name)).join(' ');
          keyLook.set(key, { label: (node.title || node.getAttribute('aria-label') || node.textContent || key).trim().slice(0, 40) || key, icon });
        }
      }
      return nodes;
    }
    const menuMode = () => state.reader ? 'menuReader' : 'menuNote';
    const menuActive = () => state.enabled && (state.actions || state.reader);
    function arrangeRow(row) {
      const { hint, box } = rowParts(row);
      if (!hint || !box) return;
      // Some themes show the ··· box's buttons only once ST marks the box open (.visible). While the row
      // is folded here, the box always carries that mark; unfolded, the row is left to ST and the theme.
      if (menuActive()) {
        if (!box.classList.contains('visible')) { box.classList.add('visible'); box.setAttribute('data-qn-visible', ''); }
      } else if (box.hasAttribute('data-qn-visible')) {
        box.classList.remove('visible');
        box.removeAttribute('data-qn-visible');
      }
      const choices = state[menuMode()];
      for (const node of noteButtons(row)) {
        if (!menuActive()) { node.removeAttribute('data-qn-menu'); continue; }
        const key = buttonKey(node);
        const mark = (choices[key] || keyDefault.get(key)) === 'in' ? 'in' : 'out';
        if (node.getAttribute('data-qn-menu') !== mark) node.setAttribute('data-qn-menu', mark);
      }
    }
    const arrangeAll = () => chat?.querySelectorAll('.mes .mes_buttons').forEach(arrangeRow);
    // Captions themes write into a message's name row (a house name on a ribbon, a motto): a pseudo-
    // element whose content is words. Ornaments without words (a highlighter, a rule) stay as they are.
    const wordy = /[\p{L}\p{N}]/u;
    const hasWords = (node, part) => (getComputedStyle(node, part).content.match(/"(?:[^"\\]|\\.)*"/g) || []).some(text => wordy.test(text));
    function markCaptions(scope = chat, fresh = false) {
      if (!scope) return;
      const marked = [...scope.querySelectorAll('[data-qn-caption]')];
      if (!state.enabled || fresh) for (const node of marked) node.removeAttribute('data-qn-caption');
      if (!state.enabled) return;
      const rows = scope.matches?.('.ch_name') ? [scope] : scope.querySelectorAll('.mes .ch_name');
      for (const row of rows) for (const node of [row, ...row.querySelectorAll('*')]) {
        if (node.hasAttribute('data-qn-caption') || node.closest('.mes_buttons, .mes_edit_buttons')) continue;
        const parts = ['before', 'after'].filter(part => hasWords(node, '::' + part));
        if (parts.length) node.setAttribute('data-qn-caption', parts.join(' '));
      }
    }
    // Two zones of icon chips, like the message's own row and its ··· menu; a tap moves a button across.
    function menuPicker(modeKey, shownBy) {
      const outZone = el('div', { className: 'qn-chips' });
      const inZone = el('div', { className: 'qn-chips qn-chips-in' });
      const caption = el('div', { className: 'qn-menu-caption' });
      // Folded by default: a summary row like the other rows, opening onto the two zones.
      const box = el('details', { className: 'qn-menu-picker' },
        el('summary', { className: 'qn-row qn-menu-summary' }, el('span', { className: 'qn-row-label', textContent: '··· 메뉴에 넣을 버튼' })),
        el('div', { className: 'qn-menu-zones' },
          el('div', { className: 'qn-zone-label', textContent: '밖에 보이는 버튼' }), outZone,
          el('div', { className: 'qn-zone-label', textContent: '··· 메뉴 안' }), inZone, caption));
      box.addEventListener('toggle', () => { if (box.open) build(); });
      function build() {
        const template = document.querySelector('#message_template .mes_buttons');
        for (const row of [template, ...(chat?.querySelectorAll('.mes .mes_buttons') || [])]) if (row) noteButtons(row);
        const choices = state[modeKey];
        const inside = key => choices[key] ? choices[key] === 'in' : keyDefault.get(key) === 'in';
        const chip = key => {
          const look = keyLook.get(key);
          const node = el('button', { type: 'button', className: 'qn-chip', title: look.label });
          node.setAttribute('aria-label', look.label);
          node.append(look.icon ? el('i', { className: 'fa-solid ' + look.icon }) : el('span', { className: 'qn-chip-abbr', textContent: look.label.slice(0, 2) }));
          node.addEventListener('click', () => {
            const next = inside(key) ? 'out' : 'in';
            // Kept even when it matches the default: where a button starts can change from one load
            // to the next (other extensions arrange the row too), and the choice must not follow it.
            choices[key] = next;
            caption.textContent = look.label + (next === 'in' ? '  →  ··· 안' : '  →  밖');
            apply();
          });
          return node;
        };
        const keys = [...keyLook.keys()];
        outZone.replaceChildren(...keys.filter(key => !inside(key)).map(chip));
        inZone.replaceChildren(...keys.filter(inside).map(chip));
      }
      syncers.push(() => { box.hidden = !state[shownBy]; if (!box.hidden && box.open) build(); });
      return box;
    }

    const section = title => el('div', { className: 'qn-section', textContent: title });
    // Tabs: 공통 (both modes) · 일반 · 전자책 (each mode's own look) · 기타 (names and reset).
    // The per-message buttons are "메시지 버튼", folded into "··· 메뉴"; in the e-book they come with the swipe arrows as "편집 도구".
    const pages = {
      공통: [
        toggle('reader', '전자책 모드'),
        toggle('avatars', '프로필 사진 가리기', { forcedInReader: true, hide: true }), toggle('media', '본문 이미지·에셋 가리기', { forcedInReader: true, hide: true }),
        toggle('embeds', '임베드 패널 가리기', { forcedInReader: true, hide: true }), toggle('names', '대화 이름 가리기', { forcedInReader: true, hide: true }),
        toggle('meta', '메시지 정보 가리기', { forcedInReader: true, hide: true }),
        section('화면'),
        row('UI 글자 크기', stepper('uiSize', '%')), row('알림 위치', choice('toast')),
      ],
      일반: [
        row('색', choice('noteColor', { swatch: true })),
        section('본문'),
        row('글꼴', fontPicker('noteFont')), toggle('noteType', '크기·간격 직접 지정'),
        row('글자 크기', stepper('noteSize', 'px', 'noteType')), row('줄 간격', stepper('noteLine', '', 'noteType')), row('문단 간격', stepper('notePara', 'em', 'noteType')),
        row('구분선', choice('noteDivider')),
        section('메시지 버튼'),
        toggle('actions', '··· 메뉴로 접기'), menuPicker('menuNote', 'actions'),
      ],
      전자책: [
        row('종이', choice('paper', { swatch: true })),
        section('본문'),
        row('글꼴', fontPicker('readerFont')), toggle('readerType', '크기·줄 간격 직접 지정'),
        row('글자 크기', stepper('readerSize', 'px', 'readerType')), row('줄 간격', stepper('readerLine', '', 'readerType')),
        row('문단 간격', stepper('readerPara', 'em')), toggle('readerIndent', '첫 줄 들여쓰기'), row('좌우 여백', stepper('readerMargin', 'px')),
        row('정렬', choice('readerAlign')), row('구분선', choice('readerDivider')),
        section('편집 도구'),
        toggle('readerTools', '편집 도구 보이기'), menuPicker('menuReader', 'readerTools'),
      ],
      기타: [
        row('탭 제목', text('titleNote')), row('전자책 탭 제목', text('titleReader')),
        row('캐릭터 이름', text('nameBot')), row('유저 이름', text('nameUser')),
        button('꾸미기 기본값으로', () => {
          for (const [key, spec] of Object.entries(looks)) state[key] = spec.value;
          for (const key of ['noteType', 'readerType', 'readerIndent']) state[key] = flags[key];
          for (const key of menus) state[key] = {};
          apply();
        }, 'menu_button qn-settings-reset'),
        el('small', { className: 'qn-settings-note', textContent: '이 기기에만 저장됩니다.' }),
      ],
    };
    const tabBar = el('div', { className: 'qn-tabs', role: 'tablist' });
    const pageBox = el('div', { className: 'qn-page' });
    let currentPage = '공통';
    const tabs = Object.keys(pages).map(name => {
      const tab = button(name, () => { currentPage = name; syncSettings(); });
      tab.setAttribute('role', 'tab');
      return [name, tab];
    });
    tabBar.append(...tabs.map(([, tab]) => tab));
    settingsBody.append(tabBar, pageBox);
    syncers.push(() => {
      for (const [name, tab] of tabs) tab.setAttribute('aria-selected', String(name === currentPage));
      if (pageBox.dataset.page !== currentPage) { pageBox.replaceChildren(...pages[currentPage]); pageBox.dataset.page = currentPage; }
    });
    const drawerContent = el('div', { className: 'inline-drawer-content' }, settingsBody);
    const settingsPanel = el('div', { id: ID, className: 'inline-drawer' },
      el('div', { className: 'inline-drawer-toggle inline-drawer-header' }, el('b', { textContent: 'Quiet Notes' }), el('div', { className: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' })),
      drawerContent);
    function mountOnce(mount) {
      const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
      if (!mount()) observer.observe(document.body, {childList: true, subtree: true});
      return observer;
    }
    const settingsObserver = mountOnce(() => {
      const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
      if (host && settingsPanel.parentElement !== host) host.append(settingsPanel);
      return !!host;
    });

    // ── Settings dialog (opened from the wand menu and the e-book bar) ──
    // Modal <dialog>s live in the top layer: themes put a transform on <html>, which would
    // otherwise pin fixed boxes to a 0px-tall page and push them off screen.
    const dialogBody = el('div', { className: 'qn-dialog-body' });
    const dialog = el('dialog', { id: 'qn-dialog', ariaLabel: 'Quiet Notes 설정' },
      el('div', { className: 'qn-dialog-card' },
        el('div', { className: 'qn-dialog-head' }, el('b', { textContent: 'Quiet Notes' }), button('✕', () => openDialog(false), 'qn-dialog-close')),
        dialogBody));
    function openDialog(open) {
      if (open === dialog.open) return;
      if (open) { dialogBody.append(settingsBody); syncSettings(); dialog.showModal(); } else dialog.close();
    }
    dialog.addEventListener('close', () => drawerContent.append(settingsBody));
    // A press on the backdrop lands on the <dialog> itself.
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    document.body.append(dialog);

    const wandLabel = el('span', { textContent: 'Quiet Notes' });
    const wandToggle = el('div', { id: 'qn-wand-toggle', className: 'list-group-item flex-container flexGap5', tabIndex: 0, title: '일코 모드 설정' },
      el('div', { className: 'extensionsMenuExtensionButton fa-fw fa-solid fa-file-lines', ariaHidden: 'true' }), wandLabel);
    wandToggle.setAttribute('role', 'button');
    wandToggle.addEventListener('click', () => openDialog(true));
    wandToggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wandToggle.click(); }
    });
    const wandContainer = el('div', { id: 'qn-wand-container', className: 'extension_container' }, wandToggle);
    const wandObserver = mountOnce(() => {
      const menu = document.getElementById('extensionsMenu');
      if (menu && wandContainer.parentElement !== menu) menu.append(wandContainer);
      return !!menu;
    });

    // ── Edge grips: thin lines above and below the chat. Drag towards the page to reveal a bar, away to fold it. ──
    // A bar that opens under the finger must not take the rest of that tap (the phone's
    // follow-up mouse/click events): presses elsewhere are dropped for a moment after a toggle.
    let guardUntil = 0;
    const guard = e => {
      if (performance.now() < guardUntil && !e.target.closest?.('.qn-edge-grip')) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    };
    for (const type of ['click', 'mousedown', 'mouseup', 'touchend', 'pointerup', 'contextmenu']) document.addEventListener(type, guard, { capture: true, signal: abort.signal });
    // Folding a bar slides it (and the grip lines) instead of snapping. Only positions animate (the
    // `translate` property, which theme `transform` rules don't touch), so a long chat isn't laid
    // out again on every frame. The top bar has its own path (foldTop); the composer's is animateFold.
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const FOLD_MS = 240;
    const FOLD_EASE = 'cubic-bezier(.2, .8, .2, 1)';
    let folding = false;
    function foldBars(kind) {
      if (kind === 'bottom') return [document.getElementById('form_sheld')].filter(Boolean);
      return (state.reader ? [readerBar] : [document.getElementById('top-settings-holder'), document.getElementById('extensionTopBar')]).filter(Boolean);
    }
    const glide = (node, shift) => Math.abs(shift) > 1
      ? node.animate([{ translate: `0 ${shift}px` }, { translate: '0 0' }], { duration: FOLD_MS, easing: FOLD_EASE })
      : null;
    function applyBars() {
      const top = state.reader ? state.readerTop : state.top;
      const compose = state.reader ? state.readerCompose : state.compose;
      root.classList.toggle('qn-top-visible', state.enabled && top);
      root.classList.toggle('qn-compose-visible', state.enabled && compose);
      for (const [node, open] of [[topEdge, top], [bottomEdge, compose]]) node.firstElementChild.setAttribute('aria-expanded', String(open));
      const form = document.getElementById('form_sheld');
      if (form) form.inert = state.enabled && !compose;
      if (state.reader && !top) showToc(false);
      try { window.localStorage.setItem(KEY, JSON.stringify({ ...state, v: 3 })); } catch { /* Session still works. */ }
    }
    // Folding the top bar works like the composer: the page takes its new layout at once (the chat
    // reaches the top, its text staying where it was), and the bars slide away over it, so the chat
    // is already there under them. Opening, the bars slide in over the chat first and the layout
    // change comes once they are in place, so the chat is never left with an empty strip above it.
    // Only positions animate (the `translate` property, which theme `transform` rules don't touch).
    let chatBarHeight = 0; // the Chat Top Bar's height in the page (it waits a little shorter while folded)
    // While it slides, the Chat Top Bar waits out of the page flow: the chat (a flex item with its own
    // z-index) would cover it, and its folded look is dimmed and hidden.
    const lift = { visibility: 'visible', opacity: '1', 'z-index': '100' };
    function keepChatPlace(change) {
      // ST keeps the chat's text in place when the chat changes height (its resize observer adjusts
      // the scroll before the next paint, in browsers with CSS field-sizing); elsewhere it's done here.
      const stHolds = window.CSS?.supports?.('field-sizing', 'content');
      const chatTop = chat ? chat.getBoundingClientRect().top : 0;
      const scrolled = chat ? chat.scrollTop : 0;
      change();
      const moved = chat ? chat.getBoundingClientRect().top - chatTop : 0;
      if (!stHolds && chat) chat.scrollTop = scrolled + moved;
      // Read from the very top, the chat stays at the top (ST's observer would push it down a bar's height).
      if (chat && scrolled <= 1) {
        chat.scrollTop = 0;
        if (stHolds) { const top = new ResizeObserver(() => { chat.scrollTop = 0; top.disconnect(); }); top.observe(chat); }
      }
      // A reading-place hold still running from a mode change keeps going from the text's new place.
      if (heldAnchor && !heldAnchor.bottom) { heldAnchor.offset -= moved; heldAnchor.textOffset -= moved; }
    }
    function foldTop(open, commit) {
      const bars = foldBars('top');
      const chatBar = state.reader ? null : document.getElementById('extensionTopBar');
      if (chatBar && !open) chatBarHeight = chatBar.getBoundingClientRect().height;
      const holder = document.getElementById('top-settings-holder');
      const shift = state.reader ? readerBar.offsetHeight || 52 : (holder?.offsetHeight || 0) + (chatBar ? chatBarHeight || chatBar.offsetHeight : 0);
      const lineBefore = topEdge.isConnected ? topEdge.getBoundingClientRect().top : 0;
      const chatBarBefore = chatBar ? chatBar.getBoundingClientRect().top : 0;
      // Its buttons fade their visibility in and out (a 0.3s transition): sliding, they'd lag behind.
      chatBar?.classList.add('qn-sliding');
      if (!open) keepChatPlace(commit);
      if (chatBar) {
        for (const [name, value] of Object.entries(lift)) chatBar.style.setProperty(name, value, 'important');
        if (chatBarHeight) chatBar.style.setProperty('min-height', `${chatBarHeight}px`);
        // A phone can draw the first frame with the two bars a few pixels apart: the Chat Top Bar's
        // own colour reaches up under the settings bar, so no chat text shows through the gap.
        chatBar.style.setProperty('box-shadow', `0 -8px 0 0 ${getComputedStyle(chatBar).backgroundColor}`, 'important');
      }
      // The bars move as one block, all by the same distance. The Chat Top Bar's place while folded
      // differs from its place in the page: opening, it ends right under the settings bar; folding,
      // it starts from where it was before the layout change.
      const offset = bar => bar !== chatBar ? 0
        : open ? (holder?.offsetHeight || 0) - chatBar.getBoundingClientRect().top
        : chatBarBefore - chatBar.getBoundingClientRect().top;
      const frames = bar => {
        const at = offset(bar);
        const shown = `0 ${at}px`, away = `0 ${at - shift}px`;
        return open ? [{ translate: away }, { translate: shown }] : [{ translate: shown }, { translate: away }];
      };
      const timing = { duration: FOLD_MS, easing: FOLD_EASE, fill: 'forwards' };
      const slides = bars.map(bar => bar.animate(frames(bar), timing));
      let lineGlide = null;
      if (topEdge.isConnected) {
        if (open) slides.push(topEdge.animate([{ translate: '0 0' }, { translate: `0 ${shift}px` }], timing));
        else lineGlide = glide(topEdge, lineBefore - topEdge.getBoundingClientRect().top);
      }
      // One start time for all: each moving layer is set up on its own, and a phone can start one a
      // frame after another, which opens a pixel's gap (or overlap) between the bars.
      const start = document.timeline?.currentTime;
      if (start != null) for (const slide of [...slides, lineGlide]) if (slide) slide.startTime = start;
      folding = true;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (open) keepChatPlace(commit);
        for (const slide of slides) slide.cancel();
        for (const name of [...Object.keys(lift), 'min-height', 'box-shadow']) chatBar?.style.removeProperty(name);
        if (chatBar) {
          // The buttons take their settled look at once, then get their transitions back.
          void getComputedStyle(chatBar.lastElementChild || chatBar).visibility;
          chatBar.classList.remove('qn-sliding');
        }
        folding = false;
      };
      // Animations pause while the page is hidden: the bar still settles on time.
      Promise.all(slides.map(slide => slide.finished.catch(() => {}))).then(finish);
      setTimeout(finish, FOLD_MS + 80);
    }
    // The composer: the page settles into its new layout at once, and everything that moved (the bar,
    // the grip lines and the text) glides there together. Folding, the bar stays on screen just long
    // enough to slide out (qn-compose-leaving), without taking space any more.
    function animateFold(kind, open, commit) {
      if (!state.enabled || reducedMotion?.matches || typeof Element.prototype.animate !== 'function') { commit(); return; }
      if (kind === 'top') { foldTop(open, commit); return; }
      const away = '0 100%';
      const leaving = 'qn-compose-leaving';
      const lines = [topEdge, bottomEdge].filter(node => node.isConnected);
      const linesBefore = lines.map(node => node.getBoundingClientRect().top);
      const chatTop = chat ? chat.getBoundingClientRect().top : 0;
      const scrolled = chat ? chat.scrollTop : 0;
      const atEnd = chat ? chat.scrollHeight - chat.clientHeight - scrolled < 40 : false;
      if (!open) root.classList.add(leaving);
      commit();
      if (chat) {
        const chatTopNow = chat.getBoundingClientRect().top;
        if (atEnd) chat.scrollTop = chat.scrollHeight;
        glide(chat, (chatTop - scrolled) - (chatTopNow - chat.scrollTop));
      }
      lines.forEach((node, i) => glide(node, linesBefore[i] - node.getBoundingClientRect().top));
      const frames = open ? [{ translate: away, opacity: 0 }, { translate: '0 0', opacity: 1 }] : [{ translate: '0 0', opacity: 1 }, { translate: away, opacity: 0 }];
      const slides = foldBars(kind).map(bar => bar.animate(frames, { duration: FOLD_MS, easing: FOLD_EASE, fill: open ? 'none' : 'forwards' }));
      if (open) return;
      folding = true;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        root.classList.remove(leaving);
        for (const slide of slides) slide.cancel();
        folding = false;
      };
      // Animations pause while the page is hidden: the bar still leaves on time.
      Promise.all(slides.map(slide => slide.finished.catch(() => {}))).then(finish);
      setTimeout(finish, FOLD_MS + 80);
    }
    function edge(kind) {
      const grip = el('div', { className: 'qn-edge-grip', tabIndex: 0, title: kind === 'top' ? '상단 도구 열기·닫기' : '입력 바 열기·닫기' });
      grip.setAttribute('role', 'button');
      const key = () => kind === 'top' ? (state.reader ? 'readerTop' : 'top') : (state.reader ? 'readerCompose' : 'compose');
      const set = open => {
        if (folding || state[key()] === open) return;
        guardUntil = performance.now() + 700;
        animateFold(kind, open, () => { state[key()] = open; applyBars(); });
      };
      // A tap flips the bar; a drag of 16px or more opens or folds it by direction.
      let startY = null;
      let moved = false;
      grip.addEventListener('pointerdown', e => { startY = e.clientY; moved = false; try { grip.setPointerCapture(e.pointerId); } catch { /* Synthetic events. */ } });
      grip.addEventListener('pointermove', e => {
        if (startY === null) return;
        if (Math.abs(e.clientY - startY) > 8) moved = true;
        if (Math.abs(e.clientY - startY) < 16) return;
        set(kind === 'top' ? e.clientY > startY : e.clientY < startY);
        startY = null; // One toggle per drag.
      });
      grip.addEventListener('pointerup', e => { if (startY !== null && !moved) { e.preventDefault(); set(!state[key()]); } startY = null; });
      grip.addEventListener('pointercancel', () => { startY = null; });
      // A touch always ends on the element it started on: cancelling it here stops the phone from
      // sending its own click afterwards to whatever now lies under the finger (a chat, a button).
      grip.addEventListener('touchend', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
      grip.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(!state[key()]); }
      });
      return el('div', { className: 'qn-edge qn-edge-' + kind }, grip);
    }
    const topEdge = edge('top');
    const bottomEdge = edge('bottom');
    function mountEdges() {
      if (!chat) return;
      if (!state.enabled) { topEdge.remove(); bottomEdge.remove(); return; }
      if (topEdge.nextElementSibling !== chat) chat.before(topEdge);
      if (bottomEdge.previousElementSibling !== chat) chat.after(bottomEdge);
    }

    // ── E-book chrome: its own app bar and contents list. The native top bar stays hidden;
    //    each row presses the matching native control, so every handler is the original one. ──
    const icon = body => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    function barButton(label, body, handler) {
      const item = button('', handler);
      item.innerHTML = icon(body);
      item.title = label;
      item.setAttribute('aria-label', label);
      return item;
    }
    const drawerNames = [
      ['#leftNavDrawerIcon', '작성 도구'], ['#API-status-top', '연결'], ['.fa-font', '서식'], ['#WIDrawerIcon', '사전'],
      ['.fa-user-cog', '환경 설정'], ['.fa-panorama', '배경'], ['.fa-cubes', '확장'], ['.fa-face-smile', '프로필'], ['#rightNavDrawerIcon', '책장'],
    ];
    const chatActions = [
      ['#extensionTopBarChatManager, #option_select_chat', '기록'], ['#extensionTopBarNewChat, #option_start_new_chat', '새 노트'],
      ['#extensionTopBarRenameChat', '제목 바꾸기'], ['#extensionTopBarCloseChat, #option_close_chat', '덮기'], ['#extensionTopBarDeleteChat', '삭제'],
    ];
    const press = node => (node.closest('.drawer-toggle') || node).click();
    const toc = el('div', { id: 'qn-toc', hidden: true });
    function showToc(show) {
      if (show) {
        const section = (title, rows) => rows.length ? [el('h4', { textContent: title }), el('div', { className: 'qn-toc-list' }, ...rows.map(([node, text]) => button(text, () => { showToc(false); press(node); })))] : [];
        const actions = chatActions.map(([selector, text]) => [document.querySelector(selector), text]).filter(([node]) => node);
        // Panels another extension has taken off the top bar (e.g. a menu arranger) stay out of the list too.
        const drawers = [...document.querySelectorAll('#top-settings-holder .drawer-icon')].filter(node => getComputedStyle(node.closest('.drawer') || node).display !== 'none').map(node => [node, drawerNames.find(([selector]) => node.matches(selector))?.[1] || node.title || '기타']);
        toc.replaceChildren(...section('이 문서', actions), ...section('서재', drawers));
      }
      toc.hidden = !show;
    }
    const readerTitle = el('span', { className: 'qn-reader-title' });
    // ‹ opens the shelf and closes it again. ST closes an open drawer on any press outside it
    // before this click runs, so the state at press time decides.
    const shelfPanel = () => document.getElementById('right-nav-panel');
    let shelfWasOpen = false;
    const shelfButton = barButton('책장', '<path d="M15 5l-7 7 7 7"/>', () => {
      showToc(false);
      const shelf = document.getElementById('rightNavDrawerIcon');
      const openNow = !!shelfPanel()?.classList.contains('openDrawer');
      if (shelf && openNow === shelfWasOpen) press(shelf);
    });
    shelfButton.addEventListener('pointerdown', () => { shelfWasOpen = !!shelfPanel()?.classList.contains('openDrawer'); }, true);
    // ☰ closes an open panel (작성 도구, 사전…) first; only with none open does it show or hide the list.
    // Panels open at press time count, since ST may already close them on the press itself.
    const openPanels = () => [...document.querySelectorAll('#top-settings-holder .drawer-content.openDrawer')].filter(panel => !panel.classList.contains('pinnedOpen'));
    let panelsAtPress = [];
    const tocButton = barButton('목차', '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".7"/><circle cx="4.5" cy="12" r=".7"/><circle cx="4.5" cy="18" r=".7"/>', () => {
      const hadPanels = panelsAtPress.length > 0 || openPanels().length > 0;
      panelsAtPress = [];
      if (!hadPanels) { showToc(toc.hidden); return; }
      showToc(false);
      for (const panel of openPanels()) {
        const icon = panel.closest('.drawer')?.querySelector('.drawer-icon');
        if (icon) press(icon);
      }
    });
    tocButton.addEventListener('pointerdown', () => { panelsAtPress = openPanels(); }, true);
    const readerBar = el('nav', { id: 'qn-reader-bar' },
      shelfButton, readerTitle, tocButton,
      barButton('보기 설정', '<path d="M3 18l4.5-11L12 18M4.6 14.5h5.8"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M20 12.5V18"/>', () => { showToc(false); openDialog(true); }));
    readerBar.setAttribute('aria-label', '읽기 도구');
    document.body.append(readerBar, toc);

    // The native top bar keeps the theme's own height; the chat starts right under it.
    const nativeBar = document.getElementById('top-settings-holder');
    const barObserver = new ResizeObserver(() => {
      const height = nativeBar.offsetHeight;
      if (state.enabled && height) root.style.setProperty('--qn-bar-h', height + 'px');
    });
    if (nativeBar) barObserver.observe(nativeBar);

    let openActions = null;
    // Change text nodes only: keep the theme's typography, decoration and DOM intact.
    const nameText = new WeakMap();
    function updateName(name) {
      const hidden = state.enabled && !state.names;
      let labelled = false;
      for (const node of name.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        let saved = nameText.get(node);
        if (!saved) saved = { original: node.data, last: node.data };
        if (node.data !== saved.last) saved.original = node.data;
        let text = saved.original;
        // A name left empty in settings keeps the real name (hide it with "메시지 정보 가리기" instead).
        const user = name.closest('.mes')?.getAttribute('is_user') === 'true';
        const replacement = user ? state.nameUser : state.nameBot;
        if (hidden && replacement && text.trim()) {
          text = labelled ? '' : replacement;
          labelled = true;
        }
        saved.last = text;
        nameText.set(node, saved);
        if (node.data !== text) node.data = text;
      }
    }
    function closeActions() {
      if (!openActions) return;
      openActions.classList.remove('qn-actions-open');
      openActions.querySelector('.extraMesButtonsHint')?.setAttribute('aria-expanded', 'false');
      openActions = null;
    }
    // Hide only media-only wrappers. Never remove iframe nodes or reset their sessions.
    const mediaSelector = 'img,video,audio,canvas,svg,picture,iframe,object,embed';
    const shells = new Set();
    function refreshShells(scope = chat) {
      if (!scope) return;
      for (const node of shells) {
        if (!node.isConnected || scope.contains(node)) {
          node.classList.remove('qn-hidden-shell');
          shells.delete(node);
        }
      }
      if (!state.enabled) return;
      const hideMedia = state.reader || !state.media;
      const hideEmbeds = state.reader || !state.embeds;
      const hiddenLeaf = node => node.matches('iframe,object,embed') ? hideEmbeds : node.matches('img,video,audio,canvas,svg,picture') && hideMedia;
      const empty = node => node.nodeType === Node.TEXT_NODE ? !node.textContent.trim() : node instanceof Element && (node.matches('br,source') || shells.has(node) || hiddenLeaf(node));
      for (const leaf of scope.querySelectorAll(mediaSelector)) {
        if (!leaf.closest('.mes_text') || !hiddenLeaf(leaf)) continue;
        let parent = leaf.parentElement;
        while (parent && !parent.matches('.mes_text')) {
          if (![...parent.childNodes].every(empty)) break;
          parent.classList.add('qn-hidden-shell');
          shells.add(parent);
          parent = parent.parentElement;
        }
      }
    }
    let blueWasOn = document.body.classList.contains('salty');
    let adjustingBlue = false;
    function syncBlue() {
      const blueEnabled = window.Salty?.getSettings?.()?.enabled;
      if (typeof blueEnabled === 'boolean') blueWasOn = blueEnabled;
      else if (!state.enabled && document.body.classList.contains('salty')) blueWasOn = true;
      const showBlue = blueWasOn && !state.enabled;
      if (document.body.classList.contains('salty') === showBlue) return;
      adjustingBlue = true;
      document.body.classList.toggle('salty', showBlue);
      adjustingBlue = false;
    }
    const blueObserver = new MutationObserver(() => { if (!adjustingBlue) syncBlue(); });
    blueObserver.observe(document.body, {attributes: true, attributeFilter: ['class']});
    const menuRows = new Set();
    const captionRoots = new Set();
    let addedMessages = 0;
    const actionsObserver = new MutationObserver(records => {
      if (!state.enabled) return;
      const mediaRoots = new Set();
      if (records.some(record => record.removedNodes.length)) {
        for (const node of shells) if (!node.isConnected) shells.delete(node);
      }
      for (const record of records) {
        if (record.type === 'attributes') {
          // ST takes its "open" mark off the ··· box on any press elsewhere: while the row is ours, it goes back.
          const box = record.target;
          if (box.hasAttribute('data-qn-visible') && !box.classList.contains('visible')) box.classList.add('visible');
          continue;
        }
        const target = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
        const name = target?.closest?.('.name_text');
        if (name && !state.names) updateName(name);
        if (target?.closest?.('.qn-hidden-shell') || record.removedNodes.length) {
          const text = target?.closest?.('.mes_text');
          if (text && (text.querySelector('.qn-hidden-shell') || target.closest('.qn-hidden-shell'))) mediaRoots.add(text);
        }
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (!state.names) {
            if (node.matches('.name_text')) updateName(node);
            else node.querySelectorAll('.name_text').forEach(updateName);
          }
          if (node.matches(mediaSelector) || node.querySelector(mediaSelector)) mediaRoots.add(node.closest('.mes_text') || node);
          // New messages, and buttons extensions add to a message later, take the chosen menu layout.
          const row = node.closest('.mes_buttons');
          if (row) menuRows.add(row);
          else node.querySelectorAll('.mes_buttons').forEach(found => menuRows.add(found));
          if (node.matches('.mes, .ch_name') || node.querySelector('.ch_name')) captionRoots.add(node);
          if (node.matches('#chat > .mes')) addedMessages++;
        }
      }
      for (const scope of mediaRoots) refreshShells(scope);
      for (const row of menuRows) arrangeRow(row);
      menuRows.clear();
      // A chat opened or older messages shown: their heights are noted afresh (one message at a time,
      // as a reply streams in, needs nothing: it is on screen and its size is remembered as it renders).
      if (addedMessages > 1) skim(true);
      addedMessages = 0;
      for (const node of captionRoots) markCaptions(node);
      captionRoots.clear();
    });
    // A theme change (ST rewrites its custom style) can add or drop captions: look again.
    const themeStyle = document.getElementById('custom-style');
    const themeObserver = new MutationObserver(() => { if (state.enabled) markCaptions(chat, true); });
    if (themeStyle) themeObserver.observe(themeStyle, {childList: true, characterData: true, subtree: true});
    // Class changes matter only on ··· boxes carrying data-qn-visible; any other one costs a single attribute check.
    if (chat) actionsObserver.observe(chat, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class']});
    document.addEventListener('click', e => {
      const toggle = e.target.closest?.('.extraMesButtonsHint');
      if (!toggle || !state.enabled || !(state.actions || state.reader)) return;
      e.stopPropagation(); // Use the native trigger without also running its expand handler.
      const actions = toggle.closest('.mes_buttons');
      if (!actions) return;
      const wasOpen = actions === openActions;
      closeActions();
      if (!wasOpen) {
        openActions = actions;
        actions.classList.add('qn-actions-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    }, {capture: true, signal: abort.signal});
    // An open message row folds on a tap elsewhere, not on a scroll: a press only counts if the finger
    // lifts again close to where it went down.
    let pressAt = null;
    document.addEventListener('pointerdown', e => {
      pressAt = openActions && !openActions.contains(e.target) ? { x: e.clientX, y: e.clientY } : null;
      if (!toc.hidden && !toc.contains(e.target) && !readerBar.contains(e.target)) showToc(false);
    }, {signal: abort.signal});
    document.addEventListener('pointerup', e => {
      if (pressAt && openActions && !openActions.contains(e.target) && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) < 10) closeActions();
      pressAt = null;
    }, {signal: abort.signal});
    document.addEventListener('pointercancel', () => { pressAt = null; }, {signal: abort.signal});
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeActions(); showToc(false); openDialog(false); }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyM' && !e.repeat) { e.preventDefault(); toggleMode(); }
    }, {signal: abort.signal});
    // E-book footer shows only the reading position, like a reader app's page indicator.
    let progressFrame = 0;
    function updateProgress() {
      progressFrame = 0;
      if (!state.enabled || !state.reader || !chat) return;
      const range = chat.scrollHeight - chat.clientHeight;
      bottomEdge.style.setProperty('--qn-read', (range > 0 ? Math.round(chat.scrollTop / range * 100) : 100) + '%');
    }
    chat?.addEventListener('scroll', () => { if (!progressFrame && state.enabled && state.reader) progressFrame = requestAnimationFrame(updateProgress); }, {passive: true, signal: abort.signal});

    let previousTitle = document.title;
    let renamedTitle = false;
    const noteIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#f7f8fa"/><g fill="none" stroke="#506b87" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h10l5 5v17H9zM19 5v6h5M13 16h7M13 21h7"/></g></svg>');
    const favicons = [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]')].map(node => ({node, href: node.getAttribute('href'), type: node.getAttribute('type')}));
    let iconsChanged = false;
    function updateFavicons() {
      if (iconsChanged === state.enabled) return;
      for (const {node, href, type} of favicons) {
        if (state.enabled) { node.setAttribute('href', noteIcon); node.setAttribute('type', 'image/svg+xml'); }
        else {
          if (href === null) node.removeAttribute('href'); else node.setAttribute('href', href);
          if (type === null) node.removeAttribute('type'); else node.setAttribute('type', type);
        }
      }
      iconsChanged = state.enabled;
    }
    let currentTitle = '';
    function titleUpdate() {
      if (state.enabled) {
        const next = (state.reader ? state.titleReader || looks.titleReader.value : state.titleNote || looks.titleNote.value);
        if (document.title !== next) {
          if (!renamedTitle || document.title !== currentTitle) previousTitle = document.title;
          document.title = next;
        }
        currentTitle = next;
        renamedTitle = true;
      } else if (renamedTitle) {
        document.title = previousTitle;
        renamedTitle = false;
      }
    }
    const title = document.querySelector('title');
    const titleObserver = new MutationObserver(titleUpdate);
    if (title) titleObserver.observe(title, {childList: true, subtree: true, characterData: true});

    // Look variables and attributes live on <html> only while incognito mode is on.
    const pick = (note, reader) => state.reader ? state[reader] : state[note];
    const fontValue = () => {
      const name = pick('noteFont', 'readerFont');
      return /^(serif|sans-serif|monospace)$/.test(name) ? name : '"' + name.replace(/"/g, '') + '"';
    };
    const lookVars = {
      '--qn-size': () => pick('noteSize', 'readerSize') + 'px', '--qn-lh': () => String(pick('noteLine', 'readerLine')),
      '--qn-font': fontValue, '--qn-r-para': () => state.readerPara + 'em', '--qn-r-margin': () => state.readerMargin + 'px',
      '--qn-n-para': () => state.notePara + 'em',
    };
    // UI text size: ST sizes its interface from --mainFontSize; the chat keeps the original value
    // (see the stylesheet), so the message text follows only its own settings.
    let uiScaled = false;
    function applyUiSize() {
      const scaled = state.enabled && state.uiSize !== 100;
      if (scaled) root.style.setProperty('--mainFontSize', 'calc(var(--fontScale, 1) * ' + (15 * state.uiSize / 100).toFixed(2) + 'px)');
      else if (uiScaled) root.style.removeProperty('--mainFontSize');
      root.toggleAttribute('data-qn-ui', scaled);
      uiScaled = scaled;
    }
    const lookAttrs = {
      'data-qn-note': () => state.noteColor, 'data-qn-paper': () => state.paper, 'data-qn-toast': () => state.toast,
      'data-qn-divider': () => pick('noteDivider', 'readerDivider'), 'data-qn-align': () => state.readerAlign,
      'data-qn-type': () => pick('noteType', 'readerType') ? 'on' : 'off',
      'data-qn-font': () => pick('noteFont', 'readerFont') ? 'on' : 'off',
      'data-qn-indent': () => state.readerIndent ? 'on' : 'off',
    };
    function applyLooks() {
      for (const [name, value] of Object.entries(lookVars)) {
        if (state.enabled) root.style.setProperty(name, value()); else root.style.removeProperty(name);
      }
      for (const [name, value] of Object.entries(lookAttrs)) {
        if (state.enabled) root.setAttribute(name, value()); else root.removeAttribute(name);
      }
      if (!state.enabled) root.style.removeProperty('--qn-bar-h');
      // One class for "a dark page": the dark rules start from it, so on a light page the browser
      // skips them at once instead of testing every element against the mode attributes.
      root.classList.toggle('qn-dark', state.enabled && (state.reader ? state.paper === 'night' : state.noteColor === 'dark'));
      applyUiSize();
    }
    function syncSettings() {
      // Page swap first, so rows on the new page sync in the same pass.
      syncers[syncers.length - 1]();
      for (const sync of syncers) sync();
    }

    function cleanup() {
      abort.abort();
      titleObserver.disconnect();
      wandObserver.disconnect();
      settingsObserver.disconnect();
      actionsObserver.disconnect();
      themeObserver.disconnect();
      blueObserver.disconnect();
      barObserver.disconnect();
      closeActions();
      state.enabled = false;
      mountEdges();
      arrangeAll();
      markCaptions();
      skim(false);
      const form = document.getElementById('form_sheld');
      if (form) form.inert = false;
      for (const node of [dialog, readerBar, toc, wandContainer, settingsPanel]) node.remove();
      refreshShells();
      syncBlue();
      applyLooks();
      chat?.querySelectorAll('.name_text').forEach(updateName);
      updateFavicons();
      for (const cls of [...root.classList]) if (cls.startsWith('qn-')) root.classList.remove(cls);
      if (renamedTitle && document.title === currentTitle) document.title = previousTitle;
    }
    window.addEventListener('pagehide', cleanup, {once: true});
    window.addEventListener('unload', cleanup, {once: true});
    // Mode and look changes reflow every message; keep the message being read (or the bottom) in place.
    function captureAnchor() {
      if (!chat || !chat.isConnected || !chat.getClientRects().length) return null;
      if (chat.scrollHeight - chat.clientHeight - chat.scrollTop < 40) return {bottom: true};
      const box = chat.getBoundingClientRect();
      // The paragraph being read, not its whole message: a message grows a lot between modes
      // (pictures, avatars, panels), its paragraphs barely. elementsFromPoint: bars may lie over the chat.
      const top = Math.max(box.top, 0);
      const y = top + Math.min(Math.max(box.bottom - top, 0) * 0.3, 160);
      const hit = document.elementsFromPoint(box.left + box.width / 2, y).find(node => node.closest?.('#chat .mes'));
      if (!hit) return null;
      const mes = hit.closest('#chat .mes');
      const text = hit.closest('#chat .mes_text :is(p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, div)') || hit.closest('#chat .mes_text');
      const at = node => node.getBoundingClientRect().top - box.top;
      return {mes, offset: at(mes), text, textOffset: text ? at(text) : 0};
    }
    function restoreAnchor(anchor) {
      if (!anchor) return;
      if (anchor.bottom) { chat.scrollTop = chat.scrollHeight; return; }
      const chatTop = chat.getBoundingClientRect().top;
      if (anchor.text?.isConnected && anchor.text.getClientRects().length) chat.scrollTop += anchor.text.getBoundingClientRect().top - chatTop - anchor.textOffset;
      else if (anchor.mes.isConnected) chat.scrollTop += anchor.mes.getBoundingClientRect().top - chatTop - anchor.offset;
    }
    // Late layout changes (stylesheets, theme rules, bar heights, fonts) keep moving the text for a
    // moment after a mode change: hold the reading position for a short while unless the reader scrolls.
    let holdFrame = 0;
    let holdCancel = null;
    let heldAnchor = null;
    function holdAnchor(anchor) {
      cancelAnimationFrame(holdFrame);
      holdCancel?.();
      restoreAnchor(anchor);
      if (!anchor) return;
      const until = performance.now() + 900;
      const stop = () => { cancelAnimationFrame(holdFrame); holdCancel?.(); };
      const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
      for (const type of inputs) chat.addEventListener(type, stop, { passive: true });
      heldAnchor = anchor;
      holdCancel = () => { for (const type of inputs) chat.removeEventListener(type, stop); holdCancel = null; heldAnchor = null; };
      const tick = now => {
        restoreAnchor(anchor);
        if (now < until) holdFrame = requestAnimationFrame(tick); else holdCancel?.();
      };
      holdFrame = requestAnimationFrame(tick);
    }
    let lastNames = null;
    let lastMedia = null;
    // Messages out of sight are left unrendered (content-visibility), which keeps long chats light:
    // restyling or relaying out the page then only touches what is on screen. While rendered, every
    // message has its size remembered by the browser (contain-intrinsic-size: auto, see the stylesheet),
    // so one waiting unrendered keeps its true height and the scroll bar and reading place stay put.
    // A mode or look change (or a chat opening) lifts this until the new layout has rendered once.
    let skimTimer = 0;
    let skimTurn = 0;
    function skim(on) {
      clearTimeout(skimTimer);
      const turn = ++skimTurn; // a later call (or the mode going off) cancels a pending one
      root.classList.remove('qn-skim');
      if (!on || !chat) return;
      // Sizes are remembered as frames render: two frames must pass with everything shown first.
      skimTimer = setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        if (turn === skimTurn && state.enabled) root.classList.add('qn-skim');
      })), 1200);
    }
    let lastCaptions = false;
    function apply() {
      const anchor = captureAnchor();
      const reader = state.enabled && state.reader;
      const top = state.reader ? state.readerTop : state.top;
      const compose = state.reader ? state.readerCompose : state.compose;
      root.classList.toggle('qn-active', state.enabled);
      root.classList.toggle('qn-actions-fold', state.enabled && (state.actions || state.reader));
      root.classList.toggle('qn-reader', reader);
      root.classList.toggle('qn-reader-tools-visible', reader && state.readerTools);
      applyLooks();
      mountEdges();
      syncBlue();
      const names = [state.enabled && !state.names, state.nameBot, state.nameUser].join('\n');
      if (lastNames !== names) { chat?.querySelectorAll('.name_text').forEach(updateName); lastNames = names; }
      if (!state.enabled || !(state.actions || state.reader) || (reader && !state.readerTools)) closeActions();
      for (const [key, visible] of Object.entries({top, compose, avatars: !reader && state.avatars, media: !reader && state.media, embeds: !reader && state.embeds, meta: !reader && state.meta})) {
        root.classList.toggle('qn-' + key + '-visible', state.enabled && visible); // Nothing stays on <html> once the mode is off.
      }
      const media = [state.enabled, reader, state.media, state.embeds].join(':');
      if (lastMedia !== media) { refreshShells(); lastMedia = media; }
      if (reader) updateProgress();
      readerTitle.textContent = state.titleReader || looks.titleReader.value;
      if (!reader || !top) showToc(false);
      for (const [node, open] of [[topEdge, top], [bottomEdge, compose]]) node.firstElementChild.setAttribute('aria-expanded', String(open));
      // The folded composer stays laid out below the screen: keep it out of reach of taps and focus.
      const form = document.getElementById('form_sheld');
      if (form) form.inert = state.enabled && !compose;
      arrangeAll();
      if (lastCaptions !== state.enabled) { markCaptions(chat, true); lastCaptions = state.enabled; }
      syncSettings();
      holdAnchor(anchor);
      skim(state.enabled);
      titleUpdate();
      updateFavicons();
      try { window.localStorage.setItem(KEY, JSON.stringify({ ...state, v: 3 })); } catch { /* Session still works. */ }
      // All original form nodes, drafts, event handlers and generation controls remain intact.
    }
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
