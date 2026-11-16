// loading.js: the "guide is thinking" state shown while waiting for the AI.
// script.js calls Loading.start(guide) right before the request and Loading.stop()
// as soon as it settles (answer, error or cancel). Nothing here watches the DOM.
window.Loading = (() => {
  const log = document.getElementById('response');
  const avatar = document.getElementById('avatar');
  const state = document.getElementById('guideState');
  let bubble = null;

  // The thinking bubble: guide avatar (pulsing) + three animated dots.
  function buildBubble(guide) {
    const msg = document.createElement('div');
    msg.className = 'msg msg--guide is-new';
    msg.id = 'typingIndicator';

    const img = document.createElement('img');
    img.className = 'avatar thinking';
    img.src = guide.avatar;
    img.alt = '';

    const dots = document.createElement('span');
    dots.className = 'typing-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<span></span><span></span><span></span>';

    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = guide.title + ' is thinking';

    const box = document.createElement('div');
    box.className = 'bubble';
    box.append(dots, label);

    const body = document.createElement('div');
    body.className = 'msg-body';
    body.appendChild(box);

    msg.append(img, body);
    return msg;
  }

  function start(guide) {
    stop();
    bubble = buildBubble(guide);
    log.appendChild(bubble);
    log.setAttribute('aria-busy', 'true');
    avatar.classList.add('thinking');
    state.textContent = 'Thinking…';
    return bubble;
  }

  function stop() {
    if (bubble) bubble.remove();
    bubble = null;
    log.removeAttribute('aria-busy');
    avatar.classList.remove('thinking');
    state.textContent = 'Ready to help';
  }

  return { start, stop };
})();
