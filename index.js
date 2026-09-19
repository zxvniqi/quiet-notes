/* Quiet Notes — no network requests; presentation preferences only. */
(() => {
  'use strict';
  const document = window.document;
  const ID = 'qn-controls';
  const KEY = 'quiet-notes.extension.v2';
  const defaults = { enabled: false, top: false, compose: false, qr: false, avatars: false, media: false, embeds: true, names: false };
  let state = { ...defaults };
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    for (const key of Object.keys(defaults)) if (typeof saved[key] === 'boolean') state[key] = saved[key];
  } catch { /* Storage may be unavailable in private browsing. */ }
  // Apply the saved mode as soon as this module loads, before constructing controls.
  document.documentElement.classList.toggle('qn-active', state.enabled);

  function boot() {
    if (document.getElementById(ID)) return;
    const root = document.documentElement;
    const abort = new AbortController();
    const bar = document.createElement('nav');
    bar.id = ID;
    bar.setAttribute('aria-label', '화면 표시');
    const brand = document.createElement('span');
    brand.className = 'qn-brand';
    brand.textContent = '메모';
    bar.append(brand);
    const buttons = {};
    function button(key, text, description, handler) {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = text;
      item.title = description;
      item.setAttribute('aria-label', description);
      item.addEventListener('click', handler);
      buttons[key] = item;
      return item;
    }
    const topButton = button('top', '도구', '상단 도구 열기/접기', () => { state.top = !state.top; apply(); });
    const composeButton = button('compose', '입력', '하단 입력 바 전체 열기/접기', () => {
      state.compose = !state.compose;
      apply();
      // Deliberately do not focus the textarea: avoid opening the phone keyboard.
    });
    const modeButton = button('mode', '일코 OFF', '일코 모드 켜기/끄기', () => { state.enabled = !state.enabled; apply(); });
    const qrButton = button('qr', '빠른 작업', 'QR 분류 열기/접기', () => { state.qr = !state.qr; if(state.qr) state.compose = true; apply(); });
    modeButton.id = 'qn-mode-toggle';
    bar.append(topButton, composeButton, qrButton, modeButton);
    const details = document.createElement('details');
    details.id = 'qn-options';
    const summary = document.createElement('summary');
    summary.textContent = '보기';
    summary.title = '이미지와 화면 표시 설정';
    const panel = document.createElement('div');
    panel.className = 'qn-panel';
    const toggles = {};
    for (const [key, text] of [
      ['avatars', '프로필 사진 표시'], ['media', '본문 이미지·에셋 표시'],
      ['embeds', '임베드 패널 표시'], ['names', '대화 이름 표시'], ['enabled', '메모 테마 사용'],
    ]) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => { state[key] = input.checked; apply(); });
      label.append(input, document.createTextNode(text));
      panel.append(label);
      toggles[key] = input;
    }
    const reset = button('reset', '기본 보기', '메모 기본 보기로 되돌리기', () => { state = { ...defaults }; apply(); });
    panel.append(reset);
    details.append(summary, panel);
    bar.append(details);
    document.body.append(bar);
    document.addEventListener('pointerdown', e => { if (!details.contains(e.target)) details.open = false; }, { signal: abort.signal });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && details.open) { details.open = false; summary.focus(); }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyM' && !e.repeat) {
        e.preventDefault(); state.enabled = !state.enabled; apply();
      }
    }, { signal: abort.signal });
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
    function titleUpdate() {
      if (state.enabled) {
        if (document.title !== '메모') { previousTitle = document.title; document.title = '메모'; }
        renamedTitle = true;
      } else if (renamedTitle) {
        document.title = previousTitle;
        renamedTitle = false;
      }
    }
    const title = document.querySelector('title');
    const titleObserver = new MutationObserver(titleUpdate);
    if (title) titleObserver.observe(title, { childList: true, subtree: true, characterData: true });
    function cleanup() {
      abort.abort();
      titleObserver.disconnect();
      bar.remove();
      state.enabled = false;
      updateFavicons();
      for (const cls of [...root.classList]) if (cls.startsWith('qn-')) root.classList.remove(cls);
      document.getElementById('qn-helper-style')?.remove();
      if (renamedTitle && document.title === '메모') document.title = previousTitle;
    }
    window.addEventListener('pagehide', cleanup, { once: true });
    window.addEventListener('unload', cleanup, { once: true });
    function apply() {
      root.classList.add('qn-installed');
      root.classList.toggle('qn-active', state.enabled);
      for (const key of ['top', 'compose', 'qr', 'avatars', 'media', 'embeds', 'names']) {
        root.classList.toggle('qn-' + key + '-visible', state[key]);
      }
      topButton.setAttribute('aria-expanded', String(!state.enabled || state.top));
      composeButton.setAttribute('aria-expanded', String(!state.enabled || state.compose));
      topButton.disabled = composeButton.disabled = qrButton.disabled = !state.enabled;
      qrButton.setAttribute('aria-expanded', String(state.enabled && state.compose && state.qr));
      modeButton.textContent = state.enabled ? '일코 ON' : '일코 OFF';
      modeButton.setAttribute('aria-pressed', String(state.enabled));
      for (const [key, input] of Object.entries(toggles)) input.checked = state[key];
      titleUpdate();
      updateFavicons();
      try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Session still works. */ }
      // All original form nodes, drafts, event handlers and generation controls remain intact.
    }
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
