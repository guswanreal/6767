const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const characters = [
  { id: 'sakura', name: 'Sakura', role: 'Your creative companion', color: '#ca779943', description: 'Hangat, ceria, dan selalu punya ide. Teman untuk setiap awal yang baru.' },
  { id: 'hikari', name: 'Hikari', role: 'Your coding companion', color: '#d4ac6440', description: 'Penuh semangat dan teliti. Siap menemani kamu menyusun kode terbaik.' },
  { id: 'yuki', name: 'Yuki', role: 'Your thinking companion', color: '#9c88be40', description: 'Tenang dan analitis. Mengurai pertanyaan rumit, satu langkah setiap kali.' },
  { id: 'aiko', name: 'Aiko', role: 'Your art companion', color: '#e4a3ba40', description: 'Imajinatif dan ekspresif. Melihat kemungkinan indah di setiap ide kecil.' },
];
const storageKey = 'guswanai-v1';
const defaults = { selected: 'sakura', conversations: [], images: {}, theme: 'dark' };
let state;
try { const saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); state = { ...defaults, ...saved }; if (!Array.isArray(state.conversations) || !characters.some(c => c.id === state.selected)) throw Error(); } catch { state = structuredClone(defaults); }
let currentId = null;
let connected = false;
let pending = false;
let uploadTarget = 'sakura';
let toastTimer;
const sampleCode = `<!doctype html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Portfolio Kreatif</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f8f1ec;color:#342a35;font-family:system-ui;padding:36px}nav{display:flex;justify-content:space-between;font-size:12px}nav b{color:#a65778}section{margin:90px 0 60px;max-width:480px}.tag{color:#a65778;font-size:11px;letter-spacing:2px}h1{font-size:clamp(35px,7vw,62px);line-height:1.1;letter-spacing:-2px}h1 span{color:#a65778}p{font-size:14px;line-height:1.8;color:#8a7985}button{background:#a65778;color:white;border:0;border-radius:30px;padding:14px 22px;cursor:pointer}.orb{width:90px;height:90px;border:1px solid #d4a6ba;border-radius:50%;display:grid;place-items:center;font-size:40px;color:#bc7f9a;margin-top:35px}footer{font-size:10px;color:#a68e9f}</style></head>
<body><nav><b>studio.guswan ✳︎</b><span>Creative developer</span></nav><section><span class="tag">HELLO, WORLD.</span><h1>Small ideas.<br><span>Beautiful things.</span></h1><p>Aku membangun pengalaman digital yang menyatukan desain, kreativitas, dan sedikit keajaiban.</p><button onclick="document.getElementById('hello').textContent='Yuk, buat sesuatu yang keren bersama! ✨'">Let's create together ↗︎</button><p id="hello" aria-live="polite"></p><div class="orb">✳︎</div></section><footer>MADE WITH CURIOSITY & A LITTLE MAGIC.</footer></body></html>`;
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4500); }
function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); return true; } catch { toast('Penyimpanan browser penuh. Data terbaru belum tersimpan.'); return false; } }
function person() { return characters.find(c => c.id === state.selected) || characters[0]; }
function imageFor(id) { const image = state.images?.[id]; return typeof image === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(image) ? image : `/characters/${id}.svg`; }
function showView(view) { $$('.view').forEach(el => el.classList.toggle('active-view', el.id === `${view}-view`)); $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view)); $('#page-name').textContent = { chat: 'AI Chat', code: 'Code Studio', images: 'Image Studio', characters: 'Karakter' }[view]; $('#sidebar').classList.remove('open'); if (view === 'code') updatePreview(); }
function renderCharacters() {
  $('#quick-characters').replaceChildren(); $('#character-grid').replaceChildren();
  characters.forEach((c, index) => {
    const quick = document.createElement('button'); quick.title = `Pilih ${c.name}`; quick.setAttribute('aria-label', `Pilih ${c.name}`); const qi = document.createElement('img'); qi.src = imageFor(c.id); qi.alt = ''; quick.append(qi); quick.onclick = () => selectCharacter(c.id); $('#quick-characters').append(quick);
    const card = document.createElement('article'); card.className = `character-card ${state.selected === c.id ? 'selected' : ''}`; card.style.setProperty('--character-color', c.color);
    const picture = document.createElement('div'); picture.className = 'character-picture'; const number = document.createElement('span'); number.className = 'character-number'; number.textContent = `0${index + 1} / COMPANION`; const img = document.createElement('img'); img.src = imageFor(c.id); img.alt = `Karakter ${c.name}`; picture.append(number, img);
    const title = document.createElement('h3'); title.textContent = c.name; const role = document.createElement('p'); role.className = 'character-role'; role.textContent = c.role; const desc = document.createElement('p'); desc.className = 'character-description'; desc.textContent = c.description;
    const select = document.createElement('button'); select.className = 'select-character'; select.textContent = state.selected === c.id ? '✓ Partner aktif' : 'Pilih partner →'; select.setAttribute('aria-label', `Pilih partner ${c.name}`); select.onclick = () => selectCharacter(c.id);
    const upload = document.createElement('button'); upload.className = 'upload-character'; upload.textContent = '↑ Unggah gambar'; upload.setAttribute('aria-label', `Unggah gambar ${c.name}`); upload.onclick = () => uploadCharacter(c.id); card.append(picture, title, role, desc, select, upload); $('#character-grid').append(card);
  });
  $('#hero-name').textContent = person().name; $('#composer-name').textContent = person().name; $('#hero-character').src = imageFor(state.selected); $('#hero-character').alt = `Ilustrasi karakter ${person().name}`;
}
function selectCharacter(id) { state.selected = id; save(); renderCharacters(); toast(`${person().name} siap menemani kamu ✦`); }
function uploadCharacter(id) { uploadTarget = id; $('#character-upload').click(); }
$('#character-upload').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000) { toast('Pilih PNG, JPG, atau WebP berukuran maksimal 5 MB.'); event.target.value = ''; return; }
  try {
    const bitmap = await createImageBitmap(file); const canvas = document.createElement('canvas'); const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height)); canvas.width = bitmap.width * scale; canvas.height = bitmap.height * scale; canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    state.images[uploadTarget] = canvas.toDataURL('image/webp', .88); if (save()) toast('Gambar karakter berhasil disimpan di browser.'); renderCharacters();
  } catch { toast('Gambar tidak dapat dibaca. Coba file lain.'); }
  event.target.value = '';
});
function renderHistory() {
  $('#history').replaceChildren();
  if (!state.conversations.length) { const p = document.createElement('p'); p.textContent = 'Ide besarmu dimulai di sini.'; $('#history').append(p); }
  state.conversations.slice(0, 12).forEach(conversation => { const b = document.createElement('button'); b.textContent = `◌  ${conversation.title}`; b.onclick = () => { if (pending) return toast('Tunggu jawaban selesai dulu.'); currentId = conversation.id; showView('chat'); renderMessages(); }; $('#history').append(b); });
}
function currentConversation() { return state.conversations.find(c => c.id === currentId); }
function appendMessage(message) {
  const row = document.createElement('article'); row.className = `message ${message.role}`;
  const avatar = document.createElement('div'); avatar.className = 'message-avatar';
  if (message.role === 'user') avatar.textContent = 'G'; else { const img = document.createElement('img'); img.src = imageFor(message.character || state.selected); img.alt = ''; avatar.append(img); }
  const body = document.createElement('div'); body.className = 'message-body'; const name = document.createElement('div'); name.className = 'message-name'; name.textContent = message.role === 'user' ? 'Kamu' : characters.find(c => c.id === message.character)?.name || person().name;
  if (message.demo) { const tag = document.createElement('small'); tag.textContent = 'MODE DEMO · BUKAN JAWABAN AI'; name.append(tag); }
  body.append(name);
  const parts = message.content.split(/(```[\w-]*\n[\s\S]*?```)/g);
  parts.forEach(part => {
    if (part.startsWith('```')) { const code = part.replace(/^```[\w-]*\n/, '').replace(/```$/, ''); const pre = document.createElement('pre'); pre.className = 'code-block'; pre.textContent = code; body.append(pre); const copy = document.createElement('button'); copy.className = 'message-action'; copy.textContent = 'Salin kode'; copy.onclick = () => copyText(code); body.append(copy); if (/<html|<!doctype/i.test(code)) { const preview = document.createElement('button'); preview.className = 'message-action'; preview.textContent = 'Buka di Code Studio ↗︎'; preview.onclick = () => { $('#code-editor').value = code; showView('code'); }; body.append(preview); } }
    else if (part) { const text = document.createElement('div'); text.className = 'message-text'; text.textContent = part; body.append(text); }
  }); row.append(avatar, body); $('#messages').append(row);
}
function renderMessages() { const conversation = currentConversation(); const hasMessages = Boolean(conversation?.messages.length); $('#welcome').hidden = hasMessages; $('#suggestions').hidden = hasMessages; $('#messages').classList.toggle('has-messages', hasMessages); $('#messages').replaceChildren(); conversation?.messages.forEach(appendMessage); }
async function api(endpoint, data) { const response = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(125000) }); const result = await response.json(); if (!response.ok) throw Error(result.error || 'Permintaan gagal.'); return result; }
async function copyText(text) { try { await navigator.clipboard.writeText(text); toast('Kode disalin.'); } catch { toast('Clipboard tidak tersedia. Salin langsung dari editor.'); } }
$('#chat-form').addEventListener('submit', async event => {
  event.preventDefault(); if (pending) return; const prompt = $('#chat-input').value.trim(); if (!prompt) return;
  let conversation = currentConversation(); if (!conversation) { conversation = { id: crypto.randomUUID(), title: prompt.slice(0, 46), messages: [] }; currentId = conversation.id; state.conversations.unshift(conversation); state.conversations = state.conversations.slice(0, 12); }
  conversation.messages.push({ role: 'user', content: prompt }); $('#chat-input').value = ''; $('#chat-input').style.height = '38px'; renderMessages(); renderHistory(); save(); pending = true; $('#send-button').disabled = true; $('#chat-input').disabled = true;
  const activeCharacter = state.selected;
  const pendingRow = document.createElement('div'); pendingRow.className = 'message-text'; pendingRow.textContent = `${person().name} sedang berpikir…`; $('#messages').append(pendingRow);
  try {
    let content;
    if (connected) { const result = await api('chat', { character: activeCharacter, messages: conversation.messages.filter(m => !m.demo && !m.error).slice(-24).map(({ role, content }) => ({ role, content })) }); content = result.content; }
    else { content = /kode|coding|website|portfolio|html/i.test(prompt) ? `Ini contoh template portfolio dari mode demo. Kamu bisa mengedit HTML-nya dan mencoba live preview di Code Studio. Hubungkan API key untuk membuat kode berdasarkan permintaanmu.\n\n\`\`\`html\n${sampleCode}\n\`\`\`` : `Hai! Aku ${characters.find(c => c.id === activeCharacter).name}. Saat ini GuswanAI berjalan dalam mode demo, jadi aku belum bisa memberikan jawaban AI untuk pertanyaanmu.\n\nKamu sudah bisa mencoba editor HTML dengan live preview, memilih empat partner, dan mengunggah gambar karakter. Untuk chat AI dan generate gambar, isi GEMINI_API_KEY di .env server lalu restart aplikasi.\n\nCoba buka Code Studio untuk mulai berkreasi ✦`; }
    conversation.messages.push({ role: 'assistant', content, character: activeCharacter, demo: !connected });
  } catch (error) { conversation.messages.push({ role: 'assistant', content: `Permintaan gagal: ${error.message}\nKamu dapat mengirim ulang pesan setelah koneksi atau konfigurasi diperbaiki.`, character: activeCharacter, error: true }); }
  finally { pending = false; $('#send-button').disabled = false; $('#chat-input').disabled = false; save(); renderMessages(); $('#chat-input').focus(); $('#messages').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
});
$('#chat-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('#chat-form').requestSubmit(); } });
$('#chat-input').addEventListener('input', event => { event.target.style.height = '38px'; event.target.style.height = `${Math.min(event.target.scrollHeight, 150)}px`; });
$('#new-chat').onclick = () => { if (pending) return toast('Tunggu jawaban selesai dulu.'); currentId = null; showView('chat'); renderMessages(); $('#chat-input').focus(); };
$$('[data-view]').forEach(b => b.onclick = () => showView(b.dataset.view));
$$('[data-action]').forEach(b => b.onclick = () => { const action = b.dataset.action; if (action === 'brainstorm') { $('#chat-input').value = 'Bantu aku brainstorming ide proyek kreatif'; $('#chat-input').focus(); } else showView(action); });
$$('[data-prompt]').forEach(b => b.onclick = () => { $('#chat-input').value = b.dataset.prompt; $('#chat-input').focus(); });
$('#see-characters').onclick = $('#model-select').onclick = () => showView('characters');
$('#upload-shortcut').onclick = () => uploadCharacter(state.selected);
$('#hero-start').onclick = () => { $('#chat-input').focus(); $('#chat-input').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
$('#menu-toggle').onclick = () => $('#sidebar').classList.toggle('open');
$('main').addEventListener('click', event => { if (!event.target.closest('#menu-toggle')) $('#sidebar').classList.remove('open'); });
$('#theme-toggle').onclick = () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; document.body.classList.toggle('light', state.theme === 'light'); save(); };
function openSettings() { $('#settings-status').textContent = connected ? '● Gemini terkonfigurasi — permintaan memakai API server.' : '● Mode demo — API key belum dikonfigurasi.'; $('#settings-dialog').showModal(); }
$('#settings-button').onclick = $('#top-settings').onclick = $('#open-guide').onclick = openSettings;
$('#settings-dialog').addEventListener('click', event => { if (event.target === $('#settings-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
$('#clear-data').onclick = () => { if (pending) return toast('Tunggu jawaban selesai sebelum menghapus data.'); if (!confirm('Hapus semua percakapan dan gambar karakter yang tersimpan di browser ini?')) return; localStorage.removeItem(storageKey); state = structuredClone(defaults); currentId = null; document.body.classList.remove('light'); renderCharacters(); renderMessages(); renderHistory(); $('#settings-dialog').close(); toast('Data lokal sudah dihapus.'); };
let previewTimer;
function updatePreview() { const security = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none';">`; const previous = $('#code-preview'); const frame = previous.cloneNode(false); frame.srcdoc = security + $('#code-editor').value; previous.replaceWith(frame); }
$('#code-editor').value = sampleCode;
$('#code-editor').addEventListener('input', () => { clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 500); });
$('#code-editor').addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); const el = event.target; el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end'); updatePreview(); } });
$('#refresh-preview').onclick = updatePreview;
$('#preview-mobile').onclick = () => $('#code-preview').classList.toggle('phone');
function download(content, filename, type) { const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([content], { type })); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('#download-code').onclick = () => download($('#code-editor').value, 'guswanai-project.html', 'text/html');
$('#code-form').addEventListener('submit', async event => { event.preventDefault(); const prompt = $('#code-prompt').value.trim(); if (!prompt) return; const button = $('#code-generate'); button.disabled = true; button.textContent = '✦ Menyusun kode…'; try { if (!connected) { $('#code-editor').value = sampleCode; toast('Template demo dimuat. Hubungkan API untuk membuat kode dari prompt.'); } else { const result = await api('chat', { character: state.selected, messages: [{ role: 'user', content: `Buat satu dokumen HTML lengkap dengan CSS dan JavaScript inline untuk permintaan ini. Jawab hanya dengan satu blok kode html:\n${prompt}` }] }); const html = result.content.match(/```(?:html)?\s*\n([\s\S]*?)```/i)?.[1] || result.content; if (!/<html|<!doctype/i.test(html)) throw Error('AI belum mengembalikan dokumen HTML. Coba prompt yang lebih spesifik.'); $('#code-editor').value = html; toast('Kode siap. Kamu bisa langsung mengeditnya.'); } updatePreview(); } catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = '✦ Generate code'; } });
$('#image-form').addEventListener('submit', async event => { event.preventDefault(); const button = $('#image-generate'); button.disabled = true; button.textContent = '✦ Melukis imajinasimu…'; $('#image-result').replaceChildren(); const status = document.createElement('p'); status.className = 'mode-hint'; status.textContent = 'Sedang membuat gambar. Proses ini bisa memerlukan waktu hingga 2 menit…'; $('#image-result').append(status); try { const result = await api('images', { prompt: $('#image-prompt').value.trim(), style: $('#image-style').value, size: $('#image-size').value }); const img = document.createElement('img'); img.src = result.image; img.alt = $('#image-prompt').value; const link = document.createElement('a'); link.href = result.image; const extension = /^data:image\/(jpeg|webp);/.exec(result.image)?.[1] || 'png'; link.download = `guswanai-creation.${extension === 'jpeg' ? 'jpg' : extension}`; link.className = 'primary-button'; link.textContent = 'Unduh gambar ↓'; $('#image-result').replaceChildren(img, link); } catch (error) { status.className = 'error-text'; status.textContent = error.message; } finally { button.disabled = false; button.textContent = '✦ Generate gambar'; } });
document.body.classList.toggle('light', state.theme === 'light'); renderCharacters(); renderHistory(); renderMessages(); updatePreview();
fetch('/api/status').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => { connected = data.connected; $('#connection').classList.toggle('connected', connected); $('#connection').replaceChildren(); const dot = document.createElement('i'); $('#connection').append(dot, document.createTextNode(connected ? 'Gemini terkonfigurasi' : 'Mode demo')); if (connected) $('#code-hint').textContent = 'Jelaskan website yang kamu inginkan. Kode AI dapat diedit dan langsung dipreview.'; }).catch(() => { $('#connection').textContent = 'Server tidak terhubung'; toast('Server tidak dapat dihubungi. Periksa apakah npm start berjalan.'); });
