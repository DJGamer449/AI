const els = {
  login: document.getElementById('login'), loginForm: document.getElementById('loginForm'), loginError: document.getElementById('loginError'),
  password: document.getElementById('password'), modelSelect: document.getElementById('modelSelect'), refreshModels: document.getElementById('refreshModels'),
  logout: document.getElementById('logout'), messages: document.getElementById('messages'), chatForm: document.getElementById('chatForm'), prompt: document.getElementById('prompt'), send: document.getElementById('send'),
  sessionList: document.getElementById('sessionList'), newChat: document.getElementById('newChat'), deleteChat: document.getElementById('deleteChat'), sessionTitle: document.getElementById('sessionTitle')
};
const HISTORY_KEY = 'melantrance.chat.sessions.v1';
let sessions = [];
let activeSessionId = null;

function nowIso() { return new Date().toISOString(); }
function newId() { return `${Date.now().toString(36)}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`; }
function createSession() { return { id: newId(), title: 'New chat', createdAt: nowIso(), updatedAt: nowIso(), messages: [] }; }
function activeSession() { return sessions.find(session => session.id === activeSessionId); }
function loadHistory() {
  try { sessions = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { sessions = []; }
  if (!Array.isArray(sessions) || !sessions.length) sessions = [createSession()];
  activeSessionId = sessions[0].id;
}
function saveHistory() { localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions)); }
function sessionPreview(session) {
  const firstUser = session.messages.find(message => message.role === 'user')?.content;
  return firstUser || 'No messages yet';
}
function sessionTitle(session) { return session.title || sessionPreview(session).slice(0, 48) || 'New chat'; }
function renderSessions() {
  els.sessionList.innerHTML = '';
  sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  sessions.forEach(session => {
    const row = document.createElement('div');
    row.className = `group flex items-center gap-2 rounded-2xl border p-2 transition ${session.id === activeSessionId ? 'border-cyan-300/50 bg-cyan-300/15' : 'border-white/10 bg-slate-950/30 hover:bg-white/10'}`;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'min-w-0 flex-1 text-left';
    button.innerHTML = `<div class="truncate text-sm font-semibold"></div><div class="truncate text-xs text-slate-400"></div>`;
    button.children[0].textContent = sessionTitle(session);
    button.children[1].textContent = sessionPreview(session);
    button.addEventListener('click', () => switchSession(session.id));
    const remove = document.createElement('button');
    remove.type = 'button'; remove.title = 'Delete session'; remove.ariaLabel = `Delete ${sessionTitle(session)}`;
    remove.className = 'rounded-xl px-2 py-1 text-sm text-slate-400 opacity-80 hover:bg-red-500/20 hover:text-red-100 group-hover:opacity-100';
    remove.textContent = '🗑'; remove.addEventListener('click', event => { event.stopPropagation(); deleteSession(session.id); });
    row.append(button, remove); els.sessionList.appendChild(row);
  });
}
function renderMessages() {
  els.messages.innerHTML = '';
  const session = activeSession();
  els.sessionTitle.textContent = session ? sessionTitle(session) : "MelanTrance's Private Unlimited AI";
  if (!session || !session.messages.length) {
    addMessage('assistant', 'Start a new private chat. Your chat history stays in this browser until you delete it.', false);
    return;
  }
  session.messages.forEach(message => addMessage(message.role, message.content, false));
}
function touchSession(session) {
  session.updatedAt = nowIso();
  const firstUser = session.messages.find(message => message.role === 'user')?.content;
  if (firstUser) session.title = firstUser.slice(0, 56);
  saveHistory(); renderSessions(); els.sessionTitle.textContent = sessionTitle(session);
}
function switchSession(id) { activeSessionId = id; renderSessions(); renderMessages(); }
function startNewSession() { const session = createSession(); sessions.unshift(session); activeSessionId = session.id; saveHistory(); renderSessions(); renderMessages(); els.prompt.focus(); }
function deleteSession(id = activeSessionId) {
  const session = sessions.find(item => item.id === id); if (!session) return;
  if (session.messages.length && !confirm(`Delete "${sessionTitle(session)}"? This cannot be undone.`)) return;
  sessions = sessions.filter(item => item.id !== id);
  if (!sessions.length) sessions = [createSession()];
  if (activeSessionId === id) activeSessionId = sessions[0].id;
  saveHistory(); renderSessions(); renderMessages();
}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  if (res.status === 401) { showLogin(); throw new Error('Authentication required'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}
function showLogin() { els.login.classList.remove('hidden'); setTimeout(() => els.password.focus(), 0); }
function hideLogin() { els.login.classList.add('hidden'); }
function addMessage(role, text, persist = true) {
  const wrap = document.createElement('article');
  wrap.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
  const bubble = document.createElement('div');
  bubble.className = `max-w-[85%] whitespace-pre-wrap rounded-3xl px-5 py-4 shadow-lg ${role === 'user' ? 'bg-cyan-300 text-slate-950' : 'border border-white/10 bg-white/10 text-slate-100'}`;
  bubble.textContent = text;
  wrap.appendChild(bubble); els.messages.appendChild(wrap); els.messages.scrollTop = els.messages.scrollHeight;
  if (persist) { const session = activeSession(); session.messages.push({ role, content: text }); touchSession(session); }
  return bubble;
}
function extractText(response) {
  if (typeof response?.content === 'string') return response.content;
  if (Array.isArray(response?.content)) return response.content.map(part => part.text || part.content || '').join('\n').trim();
  if (response?.message?.content) return extractText(response.message);
  if (response?.choices?.[0]?.message?.content) return response.choices[0].message.content;
  return JSON.stringify(response, null, 2);
}
async function loadModels() {
  els.modelSelect.innerHTML = '<option>Loading models...</option>';
  const { data } = await api('/api/models');
  els.modelSelect.innerHTML = '';
  (data || []).forEach(model => {
    const id = model.id || model.name || model.model || String(model);
    const option = document.createElement('option'); option.value = id; option.textContent = id; els.modelSelect.appendChild(option);
  });
  if (!els.modelSelect.options.length) els.modelSelect.innerHTML = '<option value="claude-opus-4-7">claude-opus-4-7</option>';
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); els.loginError.classList.add('hidden');
  try { await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password: els.password.value }) }); hideLogin(); await loadModels(); }
  catch (err) { els.loginError.textContent = err.message; els.loginError.classList.remove('hidden'); }
});
els.logout.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); showLogin(); });
els.newChat.addEventListener('click', startNewSession);
els.deleteChat.addEventListener('click', () => deleteSession(activeSessionId));
els.refreshModels.addEventListener('click', () => loadModels().catch(err => addMessage('assistant', `Could not refresh models: ${err.message}`, false)));
els.prompt.addEventListener('input', () => { els.prompt.style.height = 'auto'; els.prompt.style.height = `${els.prompt.scrollHeight}px`; });
els.prompt.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); els.chatForm.requestSubmit(); } });
els.chatForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const text = els.prompt.value.trim(); if (!text) return;
  els.prompt.value = ''; els.prompt.style.height = 'auto'; els.send.disabled = true;
  addMessage('user', text); const pending = addMessage('assistant', 'Thinking...', false);
  try {
    const session = activeSession();
    const response = await api('/api/chat', { method: 'POST', body: JSON.stringify({ model: els.modelSelect.value, max_tokens: 1024, messages: session.messages }) });
    const answer = extractText(response) || 'No response content returned.'; pending.textContent = answer; session.messages.push({ role: 'assistant', content: answer }); touchSession(session);
  } catch (err) { pending.textContent = `Error: ${err.message}`; }
  finally { els.send.disabled = false; els.prompt.focus(); }
});

loadHistory(); renderSessions(); renderMessages();
(async function init() { try { await api('/api/auth/session'); hideLogin(); await loadModels(); } catch { showLogin(); } })();
