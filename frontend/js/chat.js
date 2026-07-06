// ─── Chat Client JavaScript (with optional Auth) ──────────────────────────
const API_BASE = 'http://localhost:3001/api';

let sessionId = null;
let conversationHistory = [];
let isTyping = false;
let clientToken = localStorage.getItem('clientToken');
let clientUser  = JSON.parse(localStorage.getItem('clientUser') || 'null');
let messageQueue = [];
let retryAttempt = 0;
const MAX_RETRIES = 3;

// ─── Initialize ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Update header with user info if logged in
  if (clientUser) {
    updateHeaderForUser(clientUser);
  }

  document.getElementById('startChatBtn').addEventListener('click', startChat);

  const input = document.getElementById('messageInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
});

// Update header to show logged-in user
function updateHeaderForUser(user) {
  const statusEl = document.querySelector('.agent-status');
  if (statusEl) {
    statusEl.innerHTML = `
      <div class="status-dot"></div>
      <span>Nova AI • Online</span>
      <span style="margin-left:10px;padding:2px 10px;background:rgba(167,139,250,0.1);border-radius:100px;font-size:12px;color:var(--purple)">
        👤 ${user.name || user.email}
      </span>
    `;
  }
  // Update admin button area — show logout option
  const adminBtn = document.querySelector('.admin-btn');
  if (adminBtn) {
    adminBtn.insertAdjacentHTML('beforebegin',
      `<button onclick="clientLogout()" style="font-size:13px;color:var(--text-muted);padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:none;cursor:pointer;transition:all 0.2s;font-family:Inter,sans-serif" onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='var(--text-muted)'">Logout</button>`
    );
  }
}

function clientLogout() {
  localStorage.removeItem('clientToken');
  localStorage.removeItem('clientUser');
  window.location.reload();
}

// ─── Start Chat Session ────────────────────────────────────────────────────
async function startChat() {
  const btn = document.getElementById('startChatBtn');
  btn.innerHTML = '<span>Connecting...</span>';
  btn.disabled  = true;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (clientToken) headers['Authorization'] = `Bearer ${clientToken}`;

    const res  = await fetch(`${API_BASE}/chat/session`, { 
      method: 'POST', 
      headers,
      timeout: 5000
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const data = await res.json();
    sessionId = data.sessionId;

    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('messagesArea').style.display  = 'flex';
    document.getElementById('chatFooter').style.display    = 'block';

    await sendAIGreeting();
  } catch (err) {
    console.error('Failed to start session:', err);
    btn.innerHTML = `<span>Start Conversation</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>`;
    btn.disabled = false;
    
    let errorMsg = 'Could not connect to server.';
    if (err.message.includes('Failed to fetch')) {
      errorMsg += ' Backend server may be offline. Make sure it is running on port 3001.';
    }
    alert(errorMsg);
  }
}

// ─── Auto Greeting ────────────────────────────────────────────────────────
async function sendAIGreeting() {
  const greeting = clientUser
    ? `Hello! I'm ${clientUser.name}. I just opened the chat.`
    : 'Hello! I just opened the chat.';

  showTyping();
  try {
    const res  = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: greeting, conversationHistory: [] })
    });
    const data = await res.json();
    hideTyping();
    appendMessage('ai', data.reply);
    conversationHistory.push(
      { role: 'user', content: greeting },
      { role: 'assistant', content: data.reply }
    );
  } catch (err) {
    hideTyping();
    const name = clientUser ? `, ${clientUser.name}` : '';
    appendMessage('ai', `👋 Hi${name}! I'm Nova, your AI guide to PixelForge Agency's services. How can I help you today?`);
  }
}

// ─── Send Message ──────────────────────────────────────────────────────────
async function sendMessage() {
  if (isTyping || !sessionId) return;

  const input = document.getElementById('messageInput');
  const msg   = input.value.trim();
  if (!msg) return;

  if (msg.length > 5000) {
    appendMessage('ai', '⚠️ Message is too long (max 5000 characters)');
    return;
  }

  appendMessage('user', msg);
  input.value       = '';
  input.style.height = 'auto';

  document.getElementById('quickPrompts').style.display = 'none';
  conversationHistory.push({ role: 'user', content: msg });

  showTyping();
  isTyping = true;
  document.getElementById('sendBtn').disabled = true;
  retryAttempt = 0;

  try {
    const res  = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: msg,
        conversationHistory: conversationHistory.slice(-10)
      })
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('Rate limited. Please wait a moment before sending another message.');
      }
      const errorData = await res.json();
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    hideTyping();
    appendMessage('ai', data.reply);
    conversationHistory.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    hideTyping();
    console.error('Message error:', err);
    
    let errorMsg = '⚠️ Sorry, I had trouble connecting. ';
    if (err.message.includes('Failed to fetch')) {
      errorMsg += 'Backend server may be offline. Please check and try again.';
    } else if (err.message.includes('Rate limited')) {
      errorMsg += err.message;
    } else {
      errorMsg += err.message || 'Please try again.';
    }
    
    appendMessage('ai', errorMsg);
    
    // Add retry button if retries available
    if (retryAttempt < MAX_RETRIES) {
      const retryBtn = document.createElement('button');
      retryBtn.textContent = '🔄 Retry';
      retryBtn.style.cssText = 'margin-top:8px;padding:6px 12px;background:var(--cyan);color:var(--bg-dark);border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;';
      retryBtn.onclick = () => {
        retryAttempt++;
        retryBtn.remove();
        sendMessage();
      };
      document.getElementById('messagesList').lastChild.appendChild(retryBtn);
    }
  } finally {
    isTyping = false;
    document.getElementById('sendBtn').disabled = false;
  }
}

// ─── Quick Prompt ──────────────────────────────────────────────────────────
function sendQuick(text) {
  document.getElementById('messageInput').value = text;
  sendMessage();
}

// ─── Append Message ────────────────────────────────────────────────────────
function appendMessage(role, content) {
  const list = document.getElementById('messagesList');
  const div  = document.createElement('div');
  div.className = `message ${role}`;

  const time    = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const avatar  = role === 'ai' ? 'N' : (clientUser ? clientUser.name[0].toUpperCase() : '👤');
  const content_formatted = content.replace(/\n/g, '<br>');

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div>
      <div class="msg-bubble">${content_formatted}</div>
      <div class="msg-time">${time}</div>
    </div>`;
  list.appendChild(div);
  scrollToBottom();
}

// ─── Typing Indicator ─────────────────────────────────────────────────────
function showTyping() {
  const list = document.getElementById('messagesList');
  const div  = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar" style="background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">N</div>
    <div class="typing-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  list.appendChild(div);
  scrollToBottom();
}
function hideTyping() {
  document.getElementById('typingIndicator')?.remove();
}
function scrollToBottom() {
  const area = document.getElementById('messagesArea');
  area.scrollTop = area.scrollHeight;
}
