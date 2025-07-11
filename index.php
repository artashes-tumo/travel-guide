<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Web Wizards</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="container py-4">

  <h1 class="mb-4 text-center glow-title">✨ AI Web Wizards</h1>

  <div class="d-flex justify-content-between mb-3">
    <button id="toggleTheme" class="btn btn-secondary">🌓 Toggle Dark Mode</button>
  </div>

  <!-- Avatar & Typing Indicator -->
  <div class="text-center mb-4">
    <img id="avatar" src="avatars/euroGuide.png" alt="Avatar" style="width:150px;" />
    <div class="typing-indicator mt-2" id="typingIndicator" hidden>
      <span></span><span></span><span></span>
    </div>
  </div>

  <!-- Card for Controls -->
  <div class="glass-card mb-4 p-4">
    <label for="characterSelect" class="form-label">Choose your Travel Guide:</label>
    <select id="characterSelect" class="form-select mb-3">
      <option value="euroGuide" selected>🌍 Europe Guide</option>
      <option value="asiaGuide">🌏 Asia Guide</option>
      <option value="africaGuide">🌍 Africa Guide</option>
      <option value="northAmericaGuide">🌎 North America Guide</option>
      <option value="southAmericaGuide">🌎 South America Guide</option>
      <option value="oceaniaGuide">🌊 Oceania Guide</option>
    </select>

    <div class="mb-3">
      <label for="voiceSelect" class="form-label">Choose voice:</label>
      <select id="voiceSelect" class="form-select"></select>
    </div>

    <div class="mb-3">
      <label for="questionInput" class="form-label">Your question:</label>
      <textarea id="questionInput" class="form-control mb-3"></textarea>
      <button id="sendBtn" class="btn btn-primary me-2">Ask AI</button>
      <button id="toggleVoice" class="btn btn-danger">🔊 Voice On</button>
    </div>
  </div>

  <!-- Response Output -->
  <h2>Response:</h2>
  <div id="response" class="p-3 border rounded mb-4" style="min-height:60px;"></div>

  <!-- Reactions -->
  <h4>React to Answer:</h4>
  <div id="reactions" class="mb-4 d-flex flex-wrap gap-2">
    <button class="btn btn-outline-primary quick-btn">😀</button>
    <button class="btn btn-outline-secondary quick-btn">😐</button>
    <button class="btn btn-outline-danger quick-btn">😢</button>
    <button id="stop" class="btn btn-warning">⛔ Stop Typing</button>
  </div>

  <!-- History -->
  <button id="clearHistoryBtn" class="btn btn-danger mb-3">🧹 Clear History</button>

  <h2>Question History:</h2>
  <ul id="historyList" class="list-group mb-5"></ul>

  <!-- Scripts -->
  <script src="script.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.min.js"></script>

</body>
</html>
