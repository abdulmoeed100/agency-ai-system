// ─── Admin Panel JavaScript (with JWT Auth) ────────────────────────────────
const API_BASE = 'http://localhost:3001/api';

let adminToken  = null;
let adminInfo   = null;
let allConversations = [];
let selectedSessionId = null;

// ─── Helper: Authenticated Fetch ──────────────────────────────────────────
function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      ...(options.headers || {})
    }
  });
}

// ─── On Page Load ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('adminToken');
  const savedAdmin = localStorage.getItem('adminInfo');

  if (savedToken && savedAdmin) {
    adminToken = savedToken;
    adminInfo  = JSON.parse(savedAdmin);
    showDashboard();
  }

  // Password enter key
  document.getElementById('adminPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
  });
  document.getElementById('adminEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
  });

  // Auto-refresh every 30s
  setInterval(() => {
    if (adminToken) { loadDashboard(); loadConversations(); }
  }, 30000);
});

// ─── Login ─────────────────────────────────────────────────────────────────
async function adminLogin() {
  const email    = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const errorEl  = document.getElementById('loginError');
  const btn      = document.getElementById('loginSubmitBtn');

  if (!email || !password) {
    showLoginError('Please enter email and password.');
    return;
  }

  if (email.length > 100 || password.length > 100) {
    showLoginError('Invalid input.');
    return;
  }

  // Loading state
  btn.disabled = true;
  document.getElementById('loginBtnText').style.display  = 'none';
  document.getElementById('loginBtnArrow').style.display = 'none';
  document.getElementById('loginSpinner').style.display  = 'block';
  errorEl.style.display = 'none';

  try {
    const res  = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!res.ok && res.status === 429) {
      throw new Error('Too many login attempts. Please try again in 15 minutes.');
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed. Check your credentials.');
    }

    adminToken = data.token;
    adminInfo  = data.admin;
    localStorage.setItem('adminToken', adminToken);
    localStorage.setItem('adminInfo',  JSON.stringify(adminInfo));
    showDashboard();
  } catch (err) {
    console.error('Login error:', err);
    let errorMsg = err.message || 'Login failed. Check your credentials.';
    if (err.message.includes('Failed to fetch')) {
      errorMsg = 'Cannot connect to server. Make sure backend is running on port 3001.';
    }
    showLoginError(errorMsg);
  } finally {
    btn.disabled = false;
    document.getElementById('loginBtnText').style.display  = 'inline';
    document.getElementById('loginBtnArrow').style.display = 'inline';
    document.getElementById('loginSpinner').style.display  = 'none';
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent    = '❌ ' + msg;
  el.style.display  = 'block';
}

function toggleAdminPw() {
  const inp = document.getElementById('adminPassword');
  const btn = document.getElementById('pwToggle');
  inp.type   = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

function showDashboard() {
  document.getElementById('loginOverlay').style.display   = 'none';
  document.getElementById('adminDashboard').style.display = 'flex';
  // Show admin name
  if (adminInfo) {
    document.getElementById('adminNameBadge').textContent = adminInfo.name || adminInfo.email || 'Admin';
  }
  loadDashboard();
  loadConversations();
  loadLeads();
}

function logout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminInfo');
  adminToken = null;
  adminInfo  = null;
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('loginOverlay').style.display   = 'flex';
  document.getElementById('adminEmail').value    = '';
  document.getElementById('adminPassword').value = '';
  document.getElementById('loginError').style.display = 'none';
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  document.getElementById(`section-${name}`).style.display = 'flex';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[onclick="showSection('${name}')"]`).classList.add('active');
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res   = await authFetch(`${API_BASE}/admin/stats`);
    if (res.status === 401) { logout(); return; }
    const stats = await res.json();

    document.getElementById('statTotal').textContent    = stats.total_conversations    ?? 0;
    document.getElementById('statActive').textContent   = stats.active_conversations   ?? 0;
    document.getElementById('statLeads').textContent    = stats.qualified_leads        ?? 0;
    document.getElementById('statMessages').textContent = stats.total_messages         ?? 0;

    const recentRes  = await authFetch(`${API_BASE}/admin/conversations`);
    const recentData = await recentRes.json();
    renderRecentConversations((recentData.conversations || []).slice(0, 8));
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderRecentConversations(convs) {
  const container = document.getElementById('recentConversations');
  if (!convs.length) {
    container.innerHTML = '<div class="empty-state">No conversations yet. Share your chatbot link! 🚀</div>';
    return;
  }
  container.innerHTML = convs.map(c => {
    const name    = c.client_name || 'Anonymous Visitor';
    const initial = name[0].toUpperCase();
    const date    = new Date(c.created_at).toLocaleDateString();
    const status  = c.client_email ? 'lead' : c.status;
    const label   = c.client_email ? '🎯 Lead' : (c.status === 'active' ? '● Active' : '✓ Closed');
    return `
      <div class="recent-item" onclick="openConversation('${c.session_id}')">
        <div class="recent-avatar">${initial}</div>
        <div class="recent-info">
          <div class="recent-name">${name}</div>
          <div class="recent-preview">${c.client_email || c.client_phone || 'Session: ' + c.session_id.slice(0,8) + '...'}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="recent-time">${date}</span>
          <span class="status-badge ${status}">${label}</span>
        </div>
      </div>`;
  }).join('');
}

// ─── Conversations ───────────────────────────────────────────────────────────
async function loadConversations() {
  try {
    const res  = await authFetch(`${API_BASE}/admin/conversations`);
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    allConversations = data.conversations || [];
    renderConvList(allConversations);
  } catch (err) {
    document.getElementById('convList').innerHTML =
      '<div class="loading-state">⚠️ Failed to load. Is the server running?</div>';
  }
}

function renderConvList(convs) {
  const container = document.getElementById('convList');
  if (!convs.length) {
    container.innerHTML = '<div class="empty-state">No conversations yet</div>';
    return;
  }
  container.innerHTML = convs.map(c => {
    const name       = c.client_name || 'Anonymous';
    const date       = new Date(c.created_at).toLocaleDateString();
    const isSelected = c.session_id === selectedSessionId ? 'selected' : '';
    return `
      <div class="conv-item ${isSelected}" id="conv-${c.session_id}" onclick="openConversation('${c.session_id}')">
        <div class="conv-item-header">
          <span class="conv-client-name">${name}</span>
          <span class="conv-date">${date}</span>
        </div>
        <div class="conv-preview">${c.client_email || c.client_phone || 'Session: ' + c.session_id.slice(0,12) + '...'}</div>
      </div>`;
  }).join('');
}

function filterConversations() {
  const q = document.getElementById('searchConv').value.toLowerCase();
  renderConvList(allConversations.filter(c =>
    (c.client_name  || '').toLowerCase().includes(q) ||
    (c.client_email || '').toLowerCase().includes(q) ||
    (c.session_id   || '').toLowerCase().includes(q)
  ));
}

async function openConversation(sessionId) {
  showSection('conversations');
  selectedSessionId = sessionId;

  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('selected'));
  const el = document.getElementById(`conv-${sessionId}`);
  if (el) el.classList.add('selected');

  const conv = allConversations.find(c => c.session_id === sessionId);
  try {
    const res  = await authFetch(`${API_BASE}/admin/conversations/${sessionId}/messages`);
    const data = await res.json();
    renderThread(conv, data.messages || []);
  } catch (err) { console.error('Load messages error:', err); }
}

function renderThread(conv, messages) {
  const panel = document.getElementById('convThreadPanel');
  const name  = conv?.client_name || 'Anonymous Visitor';
  const sub   = conv?.client_email || conv?.client_phone || 'No contact info yet';

  const msgsHtml = messages.map(m => {
    const isUser = m.role === 'user';
    const time   = new Date(m.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    return `
      <div class="thread-msg ${isUser ? 'user' : 'ai'}">
        <div class="thread-msg-avatar">${isUser ? '👤' : 'N'}</div>
        <div class="thread-msg-content">
          <div class="thread-msg-role">${isUser ? 'Client' : 'Nova AI'} · ${time}</div>
          <div class="thread-msg-text">${m.content.replace(/\n/g,'<br>')}</div>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="thread-header">
      <div class="thread-client-info">
        <div class="thread-avatar">${name[0].toUpperCase()}</div>
        <div>
          <div class="thread-client-name">${name}</div>
          <div class="thread-client-sub">${sub}</div>
        </div>
      </div>
      <div class="thread-actions">
        <select onchange="updateStatus('${conv?.session_id}', this.value)">
          <option value="active" ${conv?.status==='active' ? 'selected' : ''}>● Active</option>
          <option value="closed" ${conv?.status==='closed' ? 'selected' : ''}>✓ Closed</option>
        </select>
        <button class="thread-action-btn" onclick="copyClientInfo('${conv?.client_email||''}','${conv?.client_phone||''}')">📋 Copy Info</button>
        <button class="thread-action-btn" style="color:#ef4444;border-color:rgba(239,68,68,0.3)" onclick="deleteConversation('${conv?.session_id}')">🗑️ Delete Chat</button>
      </div>
    </div>
    <div class="thread-messages" id="threadMessages">
      ${msgsHtml || '<div class="empty-state">No messages yet</div>'}
    </div>
    <div style="padding:12px 16px;border-top:1px solid var(--border);background:rgba(255,255,255,0.01)">
      <div style="font-size:12px;color:var(--text-muted)">
        📧 ${conv?.client_email || 'No email'} &nbsp;|&nbsp;
        📞 ${conv?.client_phone || 'No phone'} &nbsp;|&nbsp;
        🏢 ${conv?.business_name || 'No business'} &nbsp;|&nbsp;
        📅 ${conv ? new Date(conv.created_at).toLocaleString() : ''}
      </div>
    </div>`;

  setTimeout(() => {
    const el = document.getElementById('threadMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 100);
}

async function updateStatus(sessionId, status) {
  try {
    await authFetch(`${API_BASE}/admin/conversations/${sessionId}/status`, {
      method: 'PUT', body: JSON.stringify({ status })
    });
    await loadConversations();
    await loadDashboard();
  } catch (err) { console.error('Status update error:', err); }
}

function copyClientInfo(email, phone) {
  navigator.clipboard.writeText(`Email: ${email||'N/A'}\nPhone: ${phone||'N/A'}`)
    .then(() => alert('Client info copied!'));
}

async function deleteConversation(sessionId) {
  if (!confirm('Are you sure you want to delete this chat? This cannot be undone.')) return;
  
  try {
    const res = await authFetch(`${API_BASE}/admin/conversations/${sessionId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete');
    
    // Clear thread panel
    document.getElementById('convThreadPanel').innerHTML = `
      <div class="thread-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <p>Chat deleted. Select another conversation.</p>
      </div>`;
    selectedSessionId = null;
    await loadConversations();
    await loadDashboard();
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete chat.');
  }
}

// ─── Leads ───────────────────────────────────────────────────────────────────
async function loadLeads() {
  try {
    const res  = await authFetch(`${API_BASE}/admin/conversations`);
    const data = await res.json();
    renderLeads((data.conversations || []).filter(c => c.client_email || c.client_phone));
  } catch (err) {
    document.getElementById('leadsTable').innerHTML = '<div class="loading-state">⚠️ Failed to load leads.</div>';
  }
}

function renderLeads(leads) {
  const container = document.getElementById('leadsTable');
  if (!leads.length) {
    container.innerHTML = '<div class="empty-state">No qualified leads yet. Keep the chatbot running! 💪</div>';
    return;
  }
  container.innerHTML = `
    <table class="leads-table">
      <thead><tr>
        <th>Client Name</th><th>Email</th><th>Phone</th>
        <th>Qualifiers</th><th>Date</th><th>Status</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${leads.map(c => {
          let qualifiers = [];
          if (c.client_email) qualifiers.push('📧 Email');
          if (c.client_phone) qualifiers.push('📞 Phone');
          const qualBadge = qualifiers.length === 2 ? '🔥 Hot Lead (Both)' : qualifiers[0];
          return `
          <tr>
            <td class="lead-name">${c.client_name || 'Unknown'}</td>
            <td class="lead-email">${c.client_email ? `<a href="mailto:${c.client_email}">${c.client_email}</a>` : '—'}</td>
            <td>${c.client_phone || '—'}</td>
            <td><span style="font-size:12px;padding:4px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981">${qualBadge}</span></td>
            <td>${new Date(c.created_at).toLocaleDateString()}</td>
            <td><span class="status-badge ${c.status==='active'?'active':'closed'}">${c.status}</span></td>
            <td><button class="thread-action-btn" onclick="openConversation('${c.session_id}')">View Chat →</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}
