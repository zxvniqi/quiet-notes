/* Quiet Notes — no network requests; presentation preferences only. */
(() => {
  'use strict';
  const document = window.document;
  const ID = 'qn-controls';
  const KEY = 'quiet-notes.extension.v2';
  const defaults = { enabled: false, top: false, compose: false, avatars: false, media: false, embeds: true, names: false, actions: true, reader: false };
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
    brand.textContent = 'Note';
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
    const composeButton = button('compose', '입력', '입력 바 열기/접기', () => {
      state.compose = !state.compose;
      apply();
      // Deliberately do not focus the textarea: avoid opening the phone keyboard.
    });
    const modeButton = button('mode', '일코 OFF', '일코 모드 켜기/끄기', () => { state.enabled = !state.enabled; apply(); });
    modeButton.id = 'qn-mode-toggle';
    const wandToggle = document.createElement('div');
    wandToggle.setAttribute('role', 'button');
    wandToggle.tabIndex = 0;
    wandToggle.title = '일코 모드 켜기/끄기';
    wandToggle.addEventListener('click', () => { state.enabled = !state.enabled; apply(); });
    wandToggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wandToggle.click(); }
    });
    wandToggle.id = 'qn-wand-toggle';
    wandToggle.className = 'list-group-item flex-container flexGap5';
    const wandIcon = document.createElement('div');
    wandIcon.className = 'extensionsMenuExtensionButton fa-fw fa-solid fa-file-lines';
    wandIcon.setAttribute('aria-hidden', 'true');
    const wandLabel = document.createElement('span');
    wandToggle.replaceChildren(wandIcon, wandLabel);
    const wandContainer = document.createElement('div');
    wandContainer.id = 'qn-wand-container';
    wandContainer.className = 'extension_container';
    wandContainer.append(wandToggle);
    function mountWand() {
      const menu = document.getElementById('extensionsMenu');
      if (!menu) return false;
      if (wandContainer.parentElement !== menu) menu.append(wandContainer);
      return true;
    }
    const wandObserver = new MutationObserver(() => { if (mountWand()) wandObserver.disconnect(); });
    if (!mountWand()) wandObserver.observe(document.body, {childList: true, subtree: true});
    const settingsHost = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    const settingsPanel = document.createElement('details');
    settingsPanel.id = 'qn-settings';
    const settingsSummary = document.createElement('summary');
    settingsSummary.textContent = 'Quiet Notes · 일코 모드';
    const settingsToggle = button('settingsMode', '일코 모드 켜기', '설정에서 일코 모드 켜기/끄기', () => { state.enabled = !state.enabled; apply(); });
    settingsPanel.append(settingsSummary, settingsToggle);
    settingsHost?.append(settingsPanel);
    composeButton.id = 'qn-input-toggle';
    composeButton.setAttribute('aria-controls', 'form_sheld');
    bar.append(topButton, composeButton, modeButton);
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
      ['embeds', '임베드 패널 표시'], ['names', '대화 이름 표시'],
      ['actions', '메시지 작업 버튼 접기'], ['reader', '일코 버전 · 노트/전자책'],
    ]) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => { state[key] = input.checked; apply(); });
      label.append(input, document.createTextNode(text));
      panel.append(label);
      toggles[key] = input;
    }
    details.append(summary, panel);
    bar.append(details);
    document.body.append(bar);
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
        if (hidden && text.trim()) {
          text = labelled ? '' : name.closest('.mes')?.getAttribute('is_user') === 'true' ? '작성' : '메모';
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
    const chat = document.getElementById('chat');
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
    const actionsObserver = new MutationObserver(records => {
      for (const record of records) {
        const name = (record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target)?.closest?.('.name_text');
        if (name) updateName(name);
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('.name_text')) updateName(node);
          else node.querySelectorAll('.name_text').forEach(updateName);
        }
      }
    });
    if (chat) actionsObserver.observe(chat, {childList: true, subtree: true, characterData: true});
    document.addEventListener('click', e => {
      const toggle = e.target.closest?.('.extraMesButtonsHint');
      if (!toggle || !state.enabled || !state.actions) return;
      e.stopPropagation(); // Use the native trigger without also running its expand handler.
      const actions = toggle.closest('.mes_buttons');
      const wasOpen = actions === openActions;
      closeActions();
      if (!wasOpen) {
        openActions = actions;
        actions.classList.add('qn-actions-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    }, {capture: true, signal: abort.signal});
    document.addEventListener('pointerdown', e => {
      if (openActions && !openActions.contains(e.target)) closeActions();
    }, {signal: abort.signal});
    document.addEventListener('pointerdown', e => { if (!details.contains(e.target)) details.open = false; }, { signal: abort.signal });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeActions();
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
      wandObserver.disconnect();
      actionsObserver.disconnect();
      blueObserver.disconnect();
      closeActions();
      bar.remove();
      wandContainer.remove();
      composeButton.remove();
      settingsPanel.remove();
      state.enabled = false;
      syncBlue();
      chat?.querySelectorAll('.name_text').forEach(updateName);
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
      root.classList.toggle('qn-actions-fold', state.enabled && state.actions);
      root.classList.toggle('qn-reader', state.enabled && state.reader);
      syncBlue();
      chat?.querySelectorAll('.name_text').forEach(updateName);
      if (!state.enabled || !state.actions) closeActions();
      for (const key of ['top', 'compose', 'avatars', 'media', 'embeds']) {
        root.classList.toggle('qn-' + key + '-visible', state[key]);
      }
      topButton.setAttribute('aria-expanded', String(!state.enabled || state.top));
      composeButton.setAttribute('aria-expanded', String(!state.enabled || state.compose));
      topButton.disabled = composeButton.disabled = !state.enabled;
      modeButton.textContent = state.enabled ? '일코 ON' : '일코 OFF';
      modeButton.setAttribute('aria-pressed', String(state.enabled));
      wandLabel.textContent = state.enabled ? '일코 모드 끄기' : '일코 모드 켜기';
      wandToggle.setAttribute('aria-pressed', String(state.enabled));
      settingsToggle.textContent = state.enabled ? '일코 모드 끄기' : '일코 모드 켜기';
      settingsToggle.setAttribute('aria-pressed', String(state.enabled));
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
