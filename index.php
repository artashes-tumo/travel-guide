<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Web Wizards — AI travel guides</title>
  <meta name="description" content="Chat with an AI travel guide for every continent." />
  <meta name="color-scheme" content="light dark" />
  <meta name="theme-color" content="#FBF6EE" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#12172A" media="(prefers-color-scheme: dark)" />
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />

  <!-- Apply the saved (or system) theme before first paint so there is no flash. -->
  <script>
    (function () {
      var theme = null;
      try { theme = localStorage.getItem('ww-theme'); } catch (e) {}
      if (theme !== 'light' && theme !== 'dark') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.dataset.theme = theme;
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650&family=Inter:wght@400;500;600&display=swap" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <a class="skip-link" href="#questionInput">Skip to the message box</a>

  <!-- Reusable SVG icons (referenced with <use href="#i-…">) -->
  <svg width="0" height="0" class="sr-only" aria-hidden="true" focusable="false">
    <symbol id="i-send" viewBox="0 0 24 24"><path d="M4 12h13M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-stop" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor"/></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
    <symbol id="i-settings" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></g></symbol>
    <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
    <symbol id="i-retry" viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  </svg>

  <div class="app">
    <!-- ===== Top bar: logo, active guide, actions ===== -->
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="./" aria-label="Web Wizards, AI travel guides — home">
          <!-- Logo mark: a compass rose whose north point ends in a spark -->
          <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <circle cx="20" cy="21" r="15.5" fill="none" stroke="currentColor" stroke-width="2" opacity=".35"/>
            <path d="M20 9 23.2 21 20 33 16.8 21Z" fill="var(--brand-ink)"/>
            <path d="M20 9 23.2 21H16.8Z" fill="var(--brand-primary)"/>
            <path d="M8 21 20 18.2 32 21 20 23.8Z" fill="var(--brand-ink)" opacity=".55"/>
            <circle cx="20" cy="21" r="2" fill="var(--bg-elev)"/>
            <path class="brand-spark" d="M20 1.5 21.1 4.4 24 5.5 21.1 6.6 20 9.5 18.9 6.6 16 5.5 18.9 4.4Z" fill="var(--brand-accent)"/>
          </svg>
          <span class="brand-text">
            <span class="brand-name">Web <em>Wizards</em></span>
            <span class="brand-tag">AI travel guides</span>
          </span>
        </a>

        <!-- Active guide. #avatar pulses while the guide is thinking (see loading.js). -->
        <div class="guide-status">
          <img id="avatar" class="avatar" src="avatars/euroGuide.png" alt="" width="40" height="40" />
          <span class="guide-status-text">
            <strong id="guideName">Europe Guide</strong>
            <span id="guideState">Ready to help</span>
          </span>
        </div>

        <div class="topbar-actions">
          <button id="toggleTheme" class="icon-btn" type="button" aria-label="Switch to dark theme">
            <svg class="icon icon-moon" aria-hidden="true"><use href="#i-moon"/></svg>
            <svg class="icon icon-sun" aria-hidden="true"><use href="#i-sun"/></svg>
          </button>
          <button id="settingsBtn" class="icon-btn" type="button" aria-haspopup="dialog" aria-controls="settingsDialog" aria-label="Settings">
            <svg class="icon" aria-hidden="true"><use href="#i-settings"/></svg>
          </button>
        </div>
      </div>
    </header>

    <!-- ===== Guide picker =====
         #characterSelect is the source of truth for the guide list and the selected guide.
         script.js builds the visual cards from these <option>s. To add a guide, add an option
         here, an avatar in avatars/ and a system prompt in deepseek.php. -->
    <select id="characterSelect" hidden aria-hidden="true" tabindex="-1">
      <option value="euroGuide" selected
        data-name="Europe" data-title="Europe Guide" data-avatar="avatars/euroGuide.png"
        data-tagline="Old towns, rail trips &amp; café culture"
        data-suggestions='["Plan 4 days in Lisbon on a budget","Best scenic train rides in the Alps?","Where should I go for Christmas markets?"]'>Europe Guide</option>
      <option value="asiaGuide"
        data-name="Asia" data-title="Asia Guide" data-avatar="avatars/asiaGuide.png"
        data-tagline="Temples, street food &amp; etiquette"
        data-suggestions='["First trip to Japan: Tokyo or Kyoto?","Street food I must try in Bangkok","Temple etiquette I should know"]'>Asia Guide</option>
      <option value="africaGuide"
        data-name="Africa" data-title="Africa Guide" data-avatar="avatars/africaGuide.png"
        data-tagline="Safaris, wild coasts &amp; traditions"
        data-suggestions='["When is the best time for a safari in Kenya?","A week in Morocco: where to go?","How do I visit Victoria Falls?"]'>Africa Guide</option>
      <option value="northAmericaGuide"
        data-name="North America" data-title="North America Guide" data-avatar="avatars/northAmericaGuide.png"
        data-tagline="Big cities &amp; national parks"
        data-suggestions='["Plan a road trip through Utah’s parks","3 days in Mexico City","Best season to visit Banff?"]'>North America Guide</option>
      <option value="southAmericaGuide"
        data-name="South America" data-title="South America Guide" data-avatar="avatars/southAmericaGuide.png"
        data-tagline="Jungles, ruins &amp; vibrant cities"
        data-suggestions='["How do I hike to Machu Picchu?","Is Patagonia worth it in autumn?","A first-timer’s guide to Rio"]'>South America Guide</option>
      <option value="oceaniaGuide"
        data-name="Oceania" data-title="Oceania Guide" data-avatar="avatars/oceaniaGuide.png"
        data-tagline="Reefs, islands &amp; laid-back vibes"
        data-suggestions='["Two weeks in New Zealand’s South Island","Snorkelling the Great Barrier Reef","Which Pacific island suits families?"]'>Oceania Guide</option>
      <option value="chips"
        data-name="Chips" data-title="Chips" data-avatar="avatars/chips.svg"
        data-tagline="Contemporary studies (allegedly)"
        data-suggestions='["Is Paris worth visiting?","How far is it to the nearest beach?","Yes or no: should I bring an umbrella?"]'>Chips</option>
    </select>

    <nav class="guide-bar" aria-label="Travel guides">
      <fieldset class="guide-picker">
        <legend class="sr-only">Choose your travel guide</legend>
        <div class="guide-scroll" id="guideCards"><!-- filled by script.js --></div>
      </fieldset>
    </nav>

    <!-- ===== Conversation ===== -->
    <main class="chat" id="chat">
      <!-- The conversation for the selected guide. It is also the question history.
           aria-live is off here because answers are typed out; finished answers are announced in #srAnnouncer. -->
      <div id="response" class="chat-log" role="log" aria-live="off" aria-label="Conversation"></div>
    </main>

    <!-- Screen-reader announcements: finished answers, errors and status changes -->
    <div id="srAnnouncer" class="sr-only" aria-live="polite" aria-atomic="true"></div>

    <!-- ===== Message bar ===== -->
    <form class="composer" id="composer" novalidate>
      <div class="composer-inner">
        <div class="composer-box">
          <label for="questionInput" class="sr-only">Ask your travel guide a question</label>
          <textarea id="questionInput" rows="1" placeholder="Ask your guide anything…" enterkeyhint="send" autocomplete="off"></textarea>
          <button id="stop" class="composer-btn composer-btn--stop" type="button" hidden aria-label="Stop the answer">
            <svg class="icon" aria-hidden="true"><use href="#i-stop"/></svg>
          </button>
          <button id="sendBtn" class="composer-btn composer-btn--send" type="submit" aria-label="Send question" disabled>
            <svg class="icon" aria-hidden="true"><use href="#i-send"/></svg>
          </button>
        </div>
        <p class="composer-hint" aria-hidden="true"><kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line</p>
      </div>
    </form>
  </div>

  <!-- ===== Settings drawer (native <dialog>: focus trap and Esc to close come for free) ===== -->
  <dialog id="settingsDialog" class="drawer" aria-labelledby="settingsTitle">
    <div class="drawer-head">
      <h2 id="settingsTitle">Settings</h2>
      <button class="icon-btn" type="button" data-close-dialog aria-label="Close settings">
        <svg class="icon" aria-hidden="true"><use href="#i-close"/></svg>
      </button>
    </div>

    <section class="drawer-section" aria-labelledby="voiceHeading">
      <h3 id="voiceHeading">Voice</h3>
      <div class="setting-row">
        <span id="voiceSwitchLabel">
          Read answers aloud
          <small id="voiceSupportNote">Uses your browser’s built-in speech.</small>
        </span>
        <button id="toggleVoice" class="switch" type="button" role="switch" aria-checked="true" aria-labelledby="voiceSwitchLabel">
          <span class="switch-thumb" aria-hidden="true"></span>
        </button>
      </div>
      <div class="field">
        <label for="voiceSelect">Voice</label>
        <select id="voiceSelect"><option value="">Default</option></select>
      </div>
    </section>

    <section class="drawer-section" aria-labelledby="convHeading">
      <h3 id="convHeading">Conversation</h3>
      <p class="drawer-note">Each guide keeps its own conversation on this device.</p>
      <button id="clearHistoryBtn" class="btn btn--danger" type="button">Clear conversation</button>
    </section>

    <p class="drawer-footnote">Answers are AI-generated. Double-check visas, prices and opening times before you go.</p>
  </dialog>

  <!-- Scripts: libraries first (pinned versions), then the app. `defer` keeps this order. -->
  <script defer src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"></script>
  <script defer src="loading.js"></script>
  <script defer src="script.js"></script>
</body>
</html>
