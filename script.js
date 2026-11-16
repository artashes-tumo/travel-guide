// script.js: chat logic for Web Wizards.
// Guides, conversation (= history), sending to deepseek.php, Markdown rendering,
// typewriter effect, text-to-speech, theme, settings drawer and composer.
'use strict';

(() => {
  /* ---------- Config ---------- */
  const MAX_EXCHANGES_SENT = 10;      // only the last N question/answer pairs are sent as context
  const REQUEST_TIMEOUT_MS = 60000;   // give up on the AI after a minute
  const REACTIONS = [
    { emoji: '😀', label: 'Happy' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😢', label: 'Sad' },
  ];
  const STORAGE = { theme: 'ww-theme', guide: 'ww-guide', voice: 'ww-voice', voiceOn: 'ww-voice-on' };
  const historyKey = id => 'chatHistory_' + id; // unchanged key, so existing history still loads

  /* ---------- Elements ---------- */
  const $ = id => document.getElementById(id);
  const els = {
    select: $('characterSelect'),
    cards: $('guideCards'),
    chat: $('chat'),
    log: $('response'),
    form: $('composer'),
    input: $('questionInput'),
    send: $('sendBtn'),
    stop: $('stop'),
    avatar: $('avatar'),
    guideName: $('guideName'),
    announcer: $('srAnnouncer'),
    themeBtn: $('toggleTheme'),
    settingsBtn: $('settingsBtn'),
    dialog: $('settingsDialog'),
    voiceToggle: $('toggleVoice'),
    voiceSelect: $('voiceSelect'),
    voiceNote: $('voiceSupportNote'),
    clearBtn: $('clearHistoryBtn'),
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- Small helpers ---------- */
  // localStorage can throw (private mode, blocked storage); never let that break the app.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
    remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  function parseJSON(text, fallback) {
    try { return JSON.parse(text); } catch { return fallback; }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function avatarImg(src) {
    const img = el('img', 'avatar');
    img.src = src;
    img.alt = '';
    return img;
  }

  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  // Polite screen-reader announcement (cleared first so repeats are read again).
  function announce(message) {
    els.announcer.textContent = '';
    requestAnimationFrame(() => { els.announcer.textContent = message; });
  }

  /* ---------- History (per guide, in localStorage) ---------- */
  function loadHistory(guideId) {
    const list = parseJSON(store.get(historyKey(guideId)) || '[]', []);
    return Array.isArray(list)
      ? list.filter(item => item && typeof item.q === 'string' && typeof item.a === 'string')
      : [];
  }

  function saveExchange(guideId, q, a) {
    const list = loadHistory(guideId);
    list.push({ q, a });
    store.set(historyKey(guideId), JSON.stringify(list));
  }

  /* ---------- Guides ---------- */
  // Guide data lives on the <option>s of #characterSelect in index.php.
  const guides = [...els.select.options].map(opt => ({
    id: opt.value,
    name: opt.dataset.name || opt.textContent,
    title: opt.dataset.title || opt.textContent,
    avatar: opt.dataset.avatar || `avatars/${opt.value}.png`,
    tagline: opt.dataset.tagline || '',
    suggestions: parseJSON(opt.dataset.suggestions || '[]', []),
  }));
  const guideById = Object.fromEntries(guides.map(g => [g.id, g]));
  const currentGuide = () => guideById[els.select.value] || guides[0];

  function renderGuideCards() {
    const frag = document.createDocumentFragment();
    guides.forEach(guide => {
      const label = el('label', 'guide-card');
      const radio = el('input', 'sr-only');
      radio.type = 'radio';
      radio.name = 'guide';
      radio.value = guide.id;
      radio.setAttribute('aria-label', guide.tagline ? `${guide.title}: ${guide.tagline}` : guide.title);
      radio.addEventListener('change', () => selectGuide(guide.id));

      const text = el('span', 'guide-card-text');
      text.append(el('span', 'guide-card-name', guide.name), el('span', 'guide-card-tag', guide.tagline));

      label.append(radio, avatarImg(guide.avatar), text);
      frag.appendChild(label);
    });
    els.cards.replaceChildren(frag);
  }

  function selectGuide(id, { initial = false } = {}) {
    if (!guideById[id]) id = guides[0].id;
    if (!initial && id === els.select.value) return;

    cancelActivity('switch');
    els.select.value = id;
    store.set(STORAGE.guide, id);

    const guide = currentGuide();
    const radio = els.cards.querySelector(`input[value="${id}"]`);
    if (radio) {
      radio.checked = true;
      radio.closest('.guide-card').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    // Header + composer reflect the active guide
    els.avatar.src = guide.avatar;
    if (!initial && !reducedMotion.matches) {
      els.avatar.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    }
    els.guideName.textContent = guide.title;
    els.input.placeholder = `Ask ${guide.title} anything…`;
    els.clearBtn.textContent = `Clear conversation with ${guide.title}`;

    renderConversation();
    if (!initial) announce(`Now chatting with ${guide.title}.`);
  }

  /* ---------- Markdown ---------- */
  function initMarkdown() {
    if (window.DOMPurify) {
      // Links in answers open in a new tab, safely.
      DOMPurify.addHook('afterSanitizeAttributes', node => {
        if (node.tagName === 'A' && node.hasAttribute('href')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      });
    }
  }

  // Markdown -> sanitized HTML. Falls back to plain text if a CDN library failed to load.
  function renderMarkdown(text) {
    if (window.marked && window.DOMPurify) {
      return DOMPurify.sanitize(marked.parse(text, { gfm: true, breaks: true }));
    }
    const div = el('div', null, text);
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  /* ---------- Rendering the conversation ---------- */
  function renderConversation() {
    const guide = currentGuide();
    const history = loadHistory(guide.id);
    els.log.replaceChildren();

    if (!history.length) {
      renderWelcome(guide);
    } else {
      history.forEach(item => {
        appendUser(item.q, { animate: false, pending: false });
        appendGuide(item.a, { animate: false });
      });
      renderReactions();
    }
    scrollToBottom({ force: true, instant: true });
  }

  function renderWelcome(guide) {
    const wrap = el('div', 'welcome');
    const img = avatarImg(guide.avatar);
    const greeting = guide.name === guide.title ? `Hi, I’m ${guide.name}.` : `Hi, I’m your ${guide.title}.`;
    const intro = el('p', null, `${guide.tagline}. Ask me anything about your next trip, or start with one of these:`);

    const list = el('div', 'suggestions');
    guide.suggestions.forEach(text => {
      const btn = el('button', 'suggestion', text);
      btn.type = 'button';
      btn.addEventListener('click', () => send(text));
      list.appendChild(btn);
    });

    wrap.append(img, el('h1', null, greeting), intro, list);
    els.log.appendChild(wrap);
  }

  function appendUser(text, { animate = true, pending = true } = {}) {
    const msg = el('div', 'msg msg--user' + (animate ? ' is-new' : ''));
    if (pending) msg.dataset.pending = 'true'; // not saved until the answer arrives
    const body = el('div', 'msg-body');
    body.appendChild(el('div', 'bubble', text));
    const label = el('span', 'sr-only', 'You said:');
    msg.append(label, body);
    els.log.appendChild(msg);
    return msg;
  }

  function appendGuide(markdown, { animate = true } = {}) {
    const guide = currentGuide();
    const msg = el('div', 'msg msg--guide' + (animate ? ' is-new' : ''));
    const body = el('div', 'msg-body');
    const bubble = el('div', 'bubble markdown');
    bubble.innerHTML = renderMarkdown(markdown);
    body.append(el('span', 'sr-only', `${guide.title} said:`), bubble);
    msg.append(avatarImg(guide.avatar), body);
    els.log.appendChild(msg);
    return { msg, bubble };
  }

  // Reaction buttons sit under the latest answer only.
  function removeReactions() {
    els.log.querySelectorAll('.reactions').forEach(node => node.remove());
  }

  function renderReactions() {
    removeReactions();
    const answers = els.log.querySelectorAll('.msg--guide:not(.msg--error):not(#typingIndicator)');
    const last = answers[answers.length - 1];
    if (!last || busy || typer) return;

    const row = el('div', 'reactions');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'React to this answer');
    REACTIONS.forEach(({ emoji, label }) => {
      const btn = el('button', 'quick-btn', emoji);
      btn.type = 'button';
      btn.dataset.emoji = emoji;
      btn.setAttribute('aria-label', `React: ${label}`);
      btn.addEventListener('click', () => send(emoji)); // same as before: the emoji is sent to the guide
      row.appendChild(btn);
    });
    last.querySelector('.msg-body').appendChild(row);
  }

  /* ---------- Scrolling ---------- */
  // Follow new content only if the reader is already near the bottom.
  let stickToBottom = true;
  els.chat.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = els.chat;
    stickToBottom = scrollHeight - scrollTop - clientHeight < 120;
  }, { passive: true });

  function scrollToBottom({ force = false, instant = false } = {}) {
    if (!force && !stickToBottom) return;
    els.chat.scrollTo({ top: els.chat.scrollHeight, behavior: instant || reducedMotion.matches ? 'instant' : 'smooth' });
    stickToBottom = true;
  }

  /* ---------- Typewriter ----------
     Types the *text* of already-rendered, sanitized HTML, so tags are never shown half-written.
     Each element stays hidden until its first character appears. Long answers type faster,
     so even an essay finishes in about 8 seconds. Returns { finish } to complete instantly. */
  function typewrite(container, onDone) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const parts = [];
    while (walker.nextNode()) parts.push({ node: walker.currentNode, full: walker.currentNode.nodeValue });
    const total = parts.reduce((n, p) => n + p.full.length, 0);

    if (!total || reducedMotion.matches) { onDone(); return null; }

    const hidden = [...container.querySelectorAll('*')];
    hidden.forEach(node => node.classList.add('tw-hidden'));
    parts.forEach(p => { p.node.nodeValue = ''; });

    const charsPerTick = Math.max(2, Math.ceil(total / 480));
    let index = 0;
    let pos = 0;
    let done = false;

    function reveal(node) {
      for (let n = node.parentElement; n && n !== container; n = n.parentElement) n.classList.remove('tw-hidden');
    }

    function finish() {
      if (done) return;
      done = true;
      clearInterval(timer);
      parts.forEach(p => { p.node.nodeValue = p.full; });
      hidden.forEach(node => {
        node.classList.remove('tw-hidden');
        if (!node.classList.length) node.removeAttribute('class');
      });
      onDone();
    }

    const timer = setInterval(() => {
      let budget = charsPerTick;
      while (budget > 0 && index < parts.length) {
        const part = parts[index];
        if (pos === 0) reveal(part.node);
        const take = Math.min(budget, part.full.length - pos);
        pos += take;
        budget -= take;
        part.node.nodeValue = part.full.slice(0, pos);
        if (pos >= part.full.length) { index++; pos = 0; }
      }
      scrollToBottom({ instant: true });
      if (index >= parts.length) finish();
    }, 16);

    return { finish };
  }

  /* ---------- Speech ---------- */
  const speech = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voices = [];
  let voiceOn = store.get(STORAGE.voiceOn) !== 'false';

  function populateVoiceList() {
    voices = speech.getVoices();
    const saved = store.get(STORAGE.voice) || '';
    els.voiceSelect.replaceChildren(new Option('Default', ''));
    voices.forEach(v => els.voiceSelect.add(new Option(`${v.name} (${v.lang})`, v.voiceURI)));
    // Voices are remembered by their id, so a reloaded list keeps the same choice.
    els.voiceSelect.value = voices.some(v => v.voiceURI === saved) ? saved : '';
  }

  function renderVoiceToggle() {
    els.voiceToggle.setAttribute('aria-checked', String(voiceOn));
    els.voiceSelect.disabled = !voiceOn || !speech;
  }

  function speak(text) {
    if (!speech || !voiceOn || !text) return;
    speech.cancel(); // no overlapping speech
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find(v => v.voiceURI === els.voiceSelect.value);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    speech.speak(utterance);
  }

  function stopSpeaking() {
    if (speech) speech.cancel();
  }

  function initVoice() {
    if (!speech) {
      voiceOn = false;
      els.voiceToggle.disabled = true;
      els.voiceNote.textContent = 'Your browser doesn’t support speech.';
      renderVoiceToggle();
      return;
    }
    populateVoiceList();
    speech.addEventListener?.('voiceschanged', populateVoiceList);
    renderVoiceToggle();

    els.voiceToggle.addEventListener('click', () => {
      voiceOn = !voiceOn;
      store.set(STORAGE.voiceOn, String(voiceOn));
      if (!voiceOn) stopSpeaking();
      renderVoiceToggle();
    });
    els.voiceSelect.addEventListener('change', () => store.set(STORAGE.voice, els.voiceSelect.value));
    window.addEventListener('pagehide', stopSpeaking);
  }

  /* ---------- Talking to deepseek.php ---------- */
  class ChatError extends Error {
    constructor(kind, detail, status) {
      super(kind);
      this.kind = kind;
      this.detail = detail;
      this.status = status;
    }
  }

  const ERROR_TEXT = {
    busy: 'Your guide is helping lots of travellers right now. Give it a few seconds, then try again.',
    network: 'I couldn’t reach your guide. Check your internet connection and try again.',
    timeout: 'Your guide is taking too long to answer. Please try again in a moment.',
    server: 'Your guide ran into a problem on our side. Please try again.',
    auth: 'Your guide can’t connect to the AI service right now. If you run this site, check the API key in deepseek.php.',
    request: 'That question didn’t come through properly. Try rephrasing it.',
    unexpected: 'Your guide sent back a reply I couldn’t read. Want to try again?',
    cancelled: 'You stopped this answer.',
  };

  // Same request format as before: { question, character, history: [{q, a}, …] }.
  async function requestAnswer(payload, signal) {
    let res, raw;
    try {
      res = await fetch('deepseek.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      raw = await res.text();
    } catch (err) {
      if (signal.aborted) throw new ChatError(signal.reason === 'timeout' || signal.reason === 'switch' ? signal.reason : 'cancelled');
      throw new ChatError('network', err);
    }

    const data = parseJSON(raw, null);
    if (!res.ok) {
      const kind = res.status === 429 ? 'busy'
        : res.status === 401 || res.status === 403 ? 'auth'
        : res.status >= 500 ? 'server'
        : 'request';
      throw new ChatError(kind, data || raw, res.status);
    }

    const answer = data && (data.reply || data.choices?.[0]?.message?.content);
    if (typeof answer !== 'string' || !answer.trim()) {
      // OpenRouter sometimes returns HTTP 200 with an error object inside.
      const kind = data?.error ? (data.error.code === 429 ? 'busy' : 'server') : 'unexpected';
      throw new ChatError(kind, data || raw, res.status);
    }
    return answer.trim();
  }

  /* ---------- Sending ---------- */
  let busy = false;        // a request is in flight
  let controller = null;   // AbortController for that request
  let typer = null;        // running typewriter, if any

  function updateControls() {
    els.send.disabled = busy || !els.input.value.trim();
    const showStop = busy || !!typer;
    if (!showStop && document.activeElement === els.stop) els.input.focus();
    els.stop.hidden = !showStop;
    els.stop.setAttribute('aria-label', busy ? 'Cancel the question' : 'Stop typing and show the full answer');
  }

  function finishTyping() {
    if (typer) typer.finish();
  }

  // Stop everything in progress (used when switching guide, clearing, or pressing Stop).
  function cancelActivity(reason = 'cancelled') {
    if (controller) controller.abort(reason);
    finishTyping();
    stopSpeaking();
  }

  async function send(rawQuestion, { retry = false } = {}) {
    const question = rawQuestion.trim();
    if (!question || busy) return;

    finishTyping();
    stopSpeaking();
    const guide = currentGuide();

    els.log.querySelector('.welcome')?.remove();
    els.log.querySelectorAll('.msg--error').forEach(node => node.remove());
    if (!retry) {
      // A new question replaces any earlier failed (unsaved) one.
      els.log.querySelectorAll('[data-pending]').forEach(node => node.remove());
      appendUser(question);
      els.input.value = '';
      autoGrow();
    }
    removeReactions();

    busy = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS);
    updateControls();
    window.Loading.start(guide);
    announce(`${guide.title} is thinking…`);
    scrollToBottom({ force: true });

    let answer = null;
    let error = null;
    try {
      const history = loadHistory(guide.id).slice(-MAX_EXCHANGES_SENT);
      answer = await requestAnswer({ question, character: guide.id, history }, controller.signal);
    } catch (err) {
      error = err instanceof ChatError ? err : new ChatError('unexpected', err);
    } finally {
      clearTimeout(timeout);
      controller = null;
      busy = false;
      window.Loading.stop();
    }

    // The user switched guide (or cleared) while waiting: that conversation is gone.
    if (error?.kind === 'switch' || guide.id !== currentGuide().id) { updateControls(); return; }

    if (error) {
      console.error('Guide request failed:', error.kind, error.status ?? '', error.detail ?? '');
      showError(question, error);
      updateControls();
      return;
    }

    saveExchange(guide.id, question, answer);
    els.log.querySelectorAll('[data-pending]').forEach(node => delete node.dataset.pending);

    const { bubble } = appendGuide(answer);
    const plainText = bubble.textContent.trim(); // Markdown symbols stripped for speech
    announce(`${guide.title} said: ${plainText}`);
    speak(plainText);

    typer = typewrite(bubble, () => {
      typer = null;
      updateControls();
      renderReactions();
    });
    updateControls();
    scrollToBottom();
    if (finePointer.matches) els.input.focus();
  }

  function showError(question, error) {
    const msg = el('div', 'msg msg--guide msg--error is-new');
    const body = el('div', 'msg-body');
    const bubble = el('div', 'bubble');
    bubble.setAttribute('role', 'alert');
    const text = ERROR_TEXT[error.kind] || ERROR_TEXT.unexpected;

    const retryBtn = el('button', 'btn-retry');
    retryBtn.type = 'button';
    retryBtn.append(icon('retry'), document.createTextNode('Try again'));
    retryBtn.addEventListener('click', () => {
      msg.remove();
      send(question, { retry: true });
    });

    bubble.append(el('p', null, text), retryBtn);
    body.appendChild(bubble);
    msg.append(avatarImg(currentGuide().avatar), body);
    els.log.appendChild(msg);
    announce(text);
    scrollToBottom({ force: true });
  }

  /* ---------- Composer ---------- */
  function autoGrow() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 180) + 'px';
  }

  function initComposer() {
    els.input.addEventListener('input', () => { autoGrow(); updateControls(); });

    // Enter sends, Shift+Enter adds a new line (ignored while an IME is composing).
    els.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        if (!els.send.disabled) els.form.requestSubmit();
      }
    });

    els.form.addEventListener('submit', e => {
      e.preventDefault();
      send(els.input.value);
    });

    // Stop: cancel a pending request, or finish the typing instantly; always stop speech.
    els.stop.addEventListener('click', () => cancelActivity('cancelled'));

    updateControls();
  }

  /* ---------- Theme ---------- */
  function applyTheme(theme, { animate = false } = {}) {
    const root = document.documentElement;
    if (animate && !reducedMotion.matches) {
      root.classList.add('theme-transition');
      setTimeout(() => root.classList.remove('theme-transition'), 400);
    }
    root.dataset.theme = theme;
    els.themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
      m.content = theme === 'dark' ? '#12172A' : '#FBF6EE';
    });
  }

  function initTheme() {
    // index.php already set data-theme before paint; sync the button and listeners.
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

    els.themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      store.set(STORAGE.theme, next);
      applyTheme(next, { animate: true });
    });

    // Follow the system setting until the user picks a theme themselves.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!store.get(STORAGE.theme)) applyTheme(e.matches ? 'dark' : 'light', { animate: true });
    });
  }

  /* ---------- Settings drawer ---------- */
  let clearTimer = null;

  function resetClearButton() {
    clearTimeout(clearTimer);
    els.clearBtn.classList.remove('is-confirming');
    els.clearBtn.textContent = `Clear conversation with ${currentGuide().title}`;
  }

  function initSettings() {
    els.settingsBtn.addEventListener('click', () => els.dialog.showModal());
    els.dialog.querySelectorAll('[data-close-dialog]').forEach(btn => btn.addEventListener('click', () => els.dialog.close()));

    // A click on the dimmed backdrop targets the <dialog> itself, outside its box: close.
    els.dialog.addEventListener('click', e => {
      if (e.target !== els.dialog) return;
      const r = els.dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) els.dialog.close();
    });
    els.dialog.addEventListener('close', resetClearButton);

    // Clearing asks for a second click, since it can't be undone.
    els.clearBtn.addEventListener('click', () => {
      if (!els.clearBtn.classList.contains('is-confirming')) {
        els.clearBtn.classList.add('is-confirming');
        els.clearBtn.textContent = 'Click again to clear. This can’t be undone';
        clearTimer = setTimeout(resetClearButton, 4000);
        return;
      }
      const guide = currentGuide();
      cancelActivity('switch');
      store.remove(historyKey(guide.id));
      renderConversation();
      els.dialog.close();
      announce(`Conversation with ${guide.title} cleared.`);
    });
  }

  /* ---------- Start ---------- */
  initMarkdown();
  renderGuideCards();
  initTheme();
  initVoice();
  initSettings();
  initComposer();
  selectGuide(store.get(STORAGE.guide) || els.select.value, { initial: true });
})();
