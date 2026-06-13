const els = {
  login: document.getElementById('login'), loginForm: document.getElementById('loginForm'), loginError: document.getElementById('loginError'),
  password: document.getElementById('password'), modelSelect: document.getElementById('modelSelect'), refreshModels: document.getElementById('refreshModels'),
  logout: document.getElementById('logout'), messages: document.getElementById('messages'), chatForm: document.getElementById('chatForm'), prompt: document.getElementById('prompt'), send: document.getElementById('send')
};
let conversation = [];

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  if (res.status === 401) { showLogin(); throw new Error('Authentication required'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}
function showLogin() { els.login.classList.remove('hidden'); setTimeout(() => els.password.focus(), 0); }
function hideLogin() { els.login.classList.add('hidden'); }
function addMessage(role, text) {
  const wrap = document.createElement('article');
  wrap.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
  const bubble = document.createElement('div');
  bubble.className = `max-w-[85%] whitespace-pre-wrap rounded-3xl px-5 py-4 shadow-lg ${role === 'user' ? 'bg-cyan-300 text-slate-950' : 'border border-white/10 bg-white/10 text-slate-100'}`;
  bubble.textContent = text;
  wrap.appendChild(bubble); els.messages.appendChild(wrap); els.messages.scrollTop = els.messages.scrollHeight;
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
els.refreshModels.addEventListener('click', () => loadModels().catch(err => addMessage('assistant', `Could not refresh models: ${err.message}`)));
els.prompt.addEventListener('input', () => { els.prompt.style.height = 'auto'; els.prompt.style.height = `${els.prompt.scrollHeight}px`; });
els.prompt.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); els.chatForm.requestSubmit(); } });
els.chatForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const text = els.prompt.value.trim(); if (!text) return;
  els.prompt.value = ''; els.prompt.style.height = 'auto'; els.send.disabled = true;
  conversation.push({ role: 'user', content: text }); addMessage('user', text); const pending = addMessage('assistant', 'Thinking...');
  try {
    const response = await api('/api/chat', { method: 'POST', body: JSON.stringify({ model: els.modelSelect.value, max_tokens: 1024, messages: conversation }) });
    const answer = extractText(response) || 'No response content returned.'; pending.textContent = answer; conversation.push({ role: 'assistant', content: answer });
  } catch (err) { pending.textContent = `Error: ${err.message}`; }
  finally { els.send.disabled = false; els.prompt.focus(); }
});

(async function init() { try { await api('/api/auth/session'); hideLogin(); await loadModels(); addMessage('assistant', 'Welcome back. Choose a model and start chatting.'); } catch { showLogin(); } })();
