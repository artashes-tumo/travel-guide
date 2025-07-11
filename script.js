let voices = [];
let selectedVoice = null;
let isVoiceOn = true;
let currentUtterance = null;

const toggleVoice = document.getElementById('toggleVoice');
const stop_typing = document.getElementById('stop');

toggleVoice.addEventListener('click', () => {
  isVoiceOn = !isVoiceOn;
  toggleVoice.textContent = isVoiceOn ? '🔊 Voice On' : '🔇 Voice Off';
  speechSynthesis.cancel();

});

stop_typing.addEventListener('click', () => {
  if (typingInterval) clearInterval(typingInterval);
});
;

function updateAvatar() {
  const character = document.getElementById("characterSelect").value;
  const avatar = document.getElementById("avatar");
  avatar.style.opacity = 0;
  setTimeout(() => {
    avatar.src = `avatars/${character}.png`;
    avatar.style.opacity = 1;
  }, 300);
}

function populateVoiceList() {
  voices = speechSynthesis.getVoices();
  const voiceSelect = document.getElementById("voiceSelect");
  voiceSelect.innerHTML = '<option value="">Default</option>';
  voices.forEach((voice, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
}

function speak(text) {
  if (!isVoiceOn) return;
  const utterance = new SpeechSynthesisUtterance(text);
  if (selectedVoice !== null && voices[selectedVoice]) {
    utterance.voice = voices[selectedVoice];
  }
  speechSynthesis.cancel(); // ensures no overlap
  speechSynthesis.speak(utterance);
}

function saveToHistory(character, q, a) {
  const key = "chatHistory_" + character;
  const history = JSON.parse(localStorage.getItem(key) || "[]");
  history.push({ q, a });
  localStorage.setItem(key, JSON.stringify(history));
  displayHistory(character);
}

function displayHistory(character) {
  const key = "chatHistory_" + character;
  const history = JSON.parse(localStorage.getItem(key) || "[]");
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";
  history.forEach(item => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.textContent = `❓ ${item.q} → 💬 ${item.a}`;
    historyList.appendChild(li);
  });
}

function clearHistory() {
  const character = document.getElementById("characterSelect").value;
  const key = "chatHistory_" + character;
  localStorage.removeItem(key);
  displayHistory(character);
}

function sendPrompt() {
  const character = document.getElementById("characterSelect").value;
  const question = document.getElementById("questionInput").value.trim();
  if (!question) return;

  const key = "chatHistory_" + character;
  const history = JSON.parse(localStorage.getItem(key) || "[]");

  fetch("deepseek.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, character, history })
  })
    .then(res => res.json())
    .then(data => {
      let answer = data.reply || data.choices?.[0]?.message?.content || data.message || "⚠️ Unexpected reply";
      showTypingEffect(answer);
      speak(answer);
      saveToHistory(character, question, answer);
      document.getElementById("questionInput").value = "";
    })
    .catch(err => {
      console.error("API Error:", err);
      document.getElementById("response").innerText = "Something went wrong.";
    });
}

let typingInterval = null; // global reference

function showTypingEffect(text) {
  const el = document.getElementById("response");
  el.innerHTML = "";
  let i = 0;

  // Convert markdown to HTML
  let converted = text.replace(/__(.*?)__/g, "<u>$1</u>");
  const rawHTML = marked.parse(converted);
  const cleanHTML = DOMPurify.sanitize(rawHTML);

  // Stop any existing typing interval
  if (typingInterval) clearInterval(typingInterval);

  typingInterval = setInterval(() => {
    el.innerHTML = cleanHTML.slice(0, i + 1);
    i++;
    if (i >= cleanHTML.length) clearInterval(typingInterval);
  }, 15);
}



function setupEmojiButtons() {
  const emojiButtons = document.querySelectorAll('.reaction-btn');
  emojiButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji || btn.textContent;
      sendPromptFromEmoji(emoji);
    });
  });
}


function sendPromptFromEmoji(emoji) {
  const character = document.getElementById("characterSelect").value;
  const question = `What does this emoji mean: ${emoji}`;
  const key = "chatHistory_" + character;
  const history = JSON.parse(localStorage.getItem(key) || "[]");

  fetch("deepseek.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, character, history })
  })
    .then(res => res.json())
    .then(data => {
      let answer = data.reply || data.choices?.[0]?.message?.content || data.message || "⚠️ Unexpected reply";
      showTypingEffect(answer);
      speak(answer);
      saveToHistory(character, question, answer);
    })
    .catch(err => {
      console.error("API Error:", err);
      document.getElementById("response").innerText = "Something went wrong.";
    });
}


function setupQuickButtons() {
  const quickBtns = document.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text || btn.textContent;
      document.getElementById("questionInput").value = text;
      sendPrompt();
    });
  });
}


function setupThemeToggle() {
  const toggle = document.getElementById('toggleTheme');
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
  });
}

window.onload = () => {
  updateAvatar();
  populateVoiceList();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  const character = document.getElementById("characterSelect").value;
  displayHistory(character);

  document.getElementById("characterSelect").addEventListener("change", () => {
    updateAvatar();
    displayHistory(document.getElementById("characterSelect").value);
  });

  document.getElementById("sendBtn").addEventListener("click", sendPrompt);
  document.getElementById("voiceSelect").addEventListener("change", e => {
    selectedVoice = e.target.value === "" ? null : Number(e.target.value);
  });
  document.getElementById("clearHistoryBtn").addEventListener("click", clearHistory);


  setupEmojiButtons();
  setupQuickButtons();
  setupThemeToggle();
};