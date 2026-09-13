/* Lumen study workspace - front-end. Works offline in demo mode.
   CONNECT markers show where Supabase / Google auth / AI proxy plug in. */

const LS = {
  get: (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f } catch (e) { return f } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
}
const $ = s => document.querySelector(s)
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s))
const todayISO = () => new Date().toISOString().slice(0, 10)
const uid = () => Math.random().toString(36).slice(2, 10)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const state = {
  tasks: LS.get('lumen.tasks', [
    { id: uid(), subject: 'Physics', topic: 'Thermodynamics - Ch. 4 problems', date: todayISO(), min: 45, done: false },
    { id: uid(), subject: 'Maths', topic: 'Definite integrals drill', date: todayISO(), min: 30, done: true },
    { id: uid(), subject: 'Chemistry', topic: 'Electrochemistry revision notes', date: todayISO(), min: 40, done: false },
  ]),
  notes: LS.get('lumen.notes', [
    { id: uid(), title: 'Entropy - intuition', tags: 'physics, revision', body: 'Entropy counts how many microstates match a macrostate.\n\n- Heat spreads out because that has more ways to happen.\n- dS = q_rev / T' },
    { id: uid(), title: 'Weekly goals', tags: 'planning', body: '14 h total. Two mock papers. Finish Ch. 4 and 5.' },
  ]),
  books: LS.get('lumen.books', [
    { id: 'demo-1', title: 'Concepts of Physics, Vol 2', pages: 412, progress: 0.36, hue: 236 },
    { id: 'demo-2', title: 'Organic Chemistry Basics', pages: 268, progress: 0.12, hue: 162 },
    { id: 'demo-3', title: 'Calculus Workbook', pages: 190, progress: 0.68, hue: 292 },
  ]),
  ink: LS.get('lumen.ink', {}),
  activeNote: null,
  book: null, page: 1, totalPages: 1, pdf: null,
  tool: 'select', color: '#F5D061',
  user: null,
  sb: LS.get('lumen.sb', null),
}
const save = () => {
  LS.set('lumen.tasks', state.tasks); LS.set('lumen.notes', state.notes)
  LS.set('lumen.books', state.books); LS.set('lumen.ink', state.ink)
}

/* ---------- routing ---------- */
function go(view) {
  $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view))
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view))
  $('#scroll').scrollTop = 0
  if (view === 'planner') renderPlanner()
  if (view === 'notes') renderNotes()
  if (view === 'books') renderBooks()
  if (view === 'progress') renderProgress()
}
$$('.nav-item').forEach(b => { b.onclick = () => { location.hash = b.dataset.view; go(b.dataset.view) } })
window.addEventListener('hashchange', () => go(location.hash.slice(1) || 'dashboard'))
window.lumenGo = go

/* ---------- dashboard ---------- */
const taskRow = t => '<li class="task ' + (t.done ? 'done' : '') + '">' +
  '<input type="checkbox" data-done="' + t.id + '"' + (t.done ? ' checked' : '') + ' />' +
  '<div class="t-main"><div>' + esc(t.topic) + '</div><div class="t-sub">' + esc(t.subject) + ' &middot; ' + t.min + ' min</div></div>' +
  '<span class="tag">' + (t.date === todayISO() ? 'today' : esc(t.date.slice(5))) + '</span>' +
  '<button class="x" data-del="' + t.id + '" title="Delete">&times;</button></li>'

function renderDash() {
  const due = state.tasks.filter(t => t.date === todayISO())
  $('#dueToday').textContent = due.filter(t => !t.done).length
  $('#hlCount').textContent = Object.keys(state.ink).reduce((a, k) => a + state.ink[k].length, 0)
  $('#dashTasks').innerHTML = due.length ? due.map(taskRow).join('')
    : '<li class="task"><div class="t-main">Nothing scheduled today.<div class="t-sub">Add a block in the planner.</div></div></li>'
  $('#dashBooks').innerHTML = state.books.slice(0, 3).map(b =>
    '<li class="task" data-open="' + b.id + '" style="cursor:pointer"><div class="t-main"><div>' + esc(b.title) + '</div>' +
    '<div class="t-sub">page ' + Math.round(b.pages * b.progress) + ' of ' + b.pages + '</div>' +
    '<div class="bar"><i style="width:' + Math.round(b.progress * 100) + '%"></i></div></div></li>').join('')
  const h = new Date().getHours()
  const first = (state.user && state.user.name ? state.user.name.split(' ')[0] : 'Abhinav')
  $('#greeting').textContent = 'Good ' + (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening') + ', ' + first
}

/* ---------- planner ---------- */
function dayLabel(d) {
  if (d === todayISO()) return 'Today'
  return new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}
function renderPlanner() {
  const groups = {}
  state.tasks.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(t => { (groups[t.date] = groups[t.date] || []).push(t) })
  const html = Object.keys(groups).map(d => {
    const ts = groups[d]
    const mins = ts.reduce((a, t) => a + (+t.min || 0), 0)
    return '<div><div class="day-head"><h3>' + dayLabel(d) + '</h3><span>' + mins + ' min planned &middot; ' +
      ts.filter(t => t.done).length + '/' + ts.length + ' done</span></div>' +
      '<ul class="task-list">' + ts.map(taskRow).join('') + '</ul></div>'
  }).join('')
  $('#plannerGroups').innerHTML = html || '<p class="muted">No blocks yet.</p>'
}
$('#pAdd').onclick = () => {
  state.tasks.push({
    id: uid(), subject: $('#pSubject').value.trim() || 'General',
    topic: $('#pTopic').value.trim() || 'Study block',
    date: $('#pDate').value || todayISO(), min: +$('#pMin').value || 30, done: false,
  })
  $('#pTopic').value = ''
  save(); renderPlanner(); renderDash()
}

document.addEventListener('change', e => {
  const id = e.target.dataset && e.target.dataset.done
  if (!id) return
  const t = state.tasks.filter(x => x.id === id)[0]
  if (t) { t.done = e.target.checked; save(); renderPlanner(); renderDash() }
})
document.addEventListener('click', e => {
  const goBtn = e.target.closest('[data-goto]')
  if (goBtn) go(goBtn.dataset.goto)
  const del = e.target.closest('[data-del]')
  if (del) { state.tasks = state.tasks.filter(t => t.id !== del.dataset.del); save(); renderPlanner(); renderDash() }
  const open = e.target.closest('[data-open]')
  if (open) openBook(open.dataset.open)
})

/* ---------- notes ---------- */
function renderNotes() {
  $('#noteList').innerHTML = state.notes.map(n =>
    '<li data-note="' + n.id + '" class="' + (n.id === state.activeNote ? 'active' : '') + '">' +
    '<div class="n-t">' + esc(n.title || 'Untitled') + '</div>' +
    '<div class="n-s">' + esc((n.body || '').slice(0, 46) || 'Empty') + '</div></li>').join('')
}
function loadNote(id) {
  const n = state.notes.filter(x => x.id === id)[0]; if (!n) return
  state.activeNote = id
  $('#noteTitle').value = n.title; $('#noteTags').value = n.tags || ''; $('#noteBody').value = n.body || ''
  renderNotes()
}
$('#noteList').onclick = e => {
  const li = e.target.closest('[data-note]'); if (li) loadNote(li.dataset.note)
}
$('#noteNew').onclick = () => {
  const n = { id: uid(), title: '', tags: '', body: '' }
  state.notes.unshift(n); save(); loadNote(n.id); $('#noteTitle').focus()
}
$('#noteDelete').onclick = () => {
  state.notes = state.notes.filter(n => n.id !== state.activeNote)
  state.activeNote = state.notes[0] ? state.notes[0].id : null
  save(); state.activeNote ? loadNote(state.activeNote) : ($('#noteTitle').value = $('#noteBody').value = '')
  renderNotes()
}
let saveTimer
;['#noteTitle', '#noteTags', '#noteBody'].forEach(sel => {
  $(sel).addEventListener('input', () => {
    const n = state.notes.filter(x => x.id === state.activeNote)[0]; if (!n) return
    n.title = $('#noteTitle').value; n.tags = $('#noteTags').value; n.body = $('#noteBody').value
    $('#noteStatus').textContent = 'Saving...'
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      save(); renderNotes(); $('#noteStatus').textContent = 'Saved ' + new Date().toLocaleTimeString()
      /* CONNECT: await sb.from('notes').upsert(n) */
    }, 400)
  })
})

/* ---------- textbooks ---------- */
function renderBooks() {
  $('#bookGrid').innerHTML = state.books.map(b =>
    '<article class="book" data-open="' + b.id + '">' +
    '<div class="cover" style="background:linear-gradient(150deg,hsl(' + b.hue + ' 52% 30%),hsl(' + ((b.hue + 40) % 360) + ' 45% 18%))">&#9776;</div>' +
    '<div class="book-body"><div class="book-t">' + esc(b.title) + '</div>' +
    '<div class="book-s">' + b.pages + ' pages &middot; ' + Math.round(b.progress * 100) + '% read</div>' +
    '<div class="bar"><i style="width:' + Math.round(b.progress * 100) + '%"></i></div></div></article>').join('')
}
$('#pdfInput').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return
  const url = URL.createObjectURL(file)
  const book = { id: uid(), title: file.name.replace(/\.pdf$/i, ''), pages: 0, progress: 0, hue: Math.floor(Math.random() * 360), url }
  state.books.unshift(book); save(); renderBooks(); openBook(book.id)
  /* CONNECT: upload to Supabase Storage bucket 'textbooks' and store the path instead of a blob URL */
})

/* ---------- reader ---------- */
const demoText = {
  1: ['4.1 The first law', 'Energy supplied to a system as heat, minus the work it does, equals the change in its internal energy. This is bookkeeping, not a new force: dU = q - w.', 'Internal energy U is a state function. Heat q and work w are not - they depend on the path taken between two states, which is why reversible and irreversible routes between the same endpoints cost different amounts of work.', 'Worked example. One mole of an ideal gas expands isothermally and reversibly from 1.0 L to 10.0 L at 300 K. Because T is constant, dU = 0, so q = w = nRT ln(V2/V1) = 5.74 kJ.'],
  2: ['4.2 Entropy and direction', 'A spontaneous change is one for which the total entropy of system plus surroundings increases. Entropy is a measure of how many microscopic arrangements are consistent with what we can measure.', 'For a reversible transfer of heat at temperature T, dS = q_rev / T. For an irreversible path between the same states, dS is the same, because S is a state function, but q/T is smaller.', 'Try it: predict the sign of dS for (a) ice melting, (b) a gas compressed into half its volume, (c) two gases mixing at constant T.'],
  3: ['4.3 Free energy', 'Combining the first and second laws gives the Gibbs energy G = H - TS. At constant temperature and pressure a process is spontaneous when dG is negative.', 'The TS term explains why endothermic reactions can still be spontaneous: a large positive entropy change can outweigh an unfavourable enthalpy change once T is high enough.', 'Summary: dH sets the energy cost, dS sets the statistical preference, and temperature decides which one wins.'],
}
function openBook(id) {
  const b = state.books.filter(x => x.id === id)[0]; if (!b) return
  state.book = b; state.page = Math.max(1, Math.round(b.pages * b.progress) || 1)
  $('#readerTitle').textContent = b.title
  go('reader')
  if (b.url && window.pdfjsLib) loadPdf(b)
  else { state.pdf = null; state.totalPages = 3; state.page = Math.min(state.page, 3); renderPage() }
}
async function loadPdf(b) {
  try {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    state.pdf = await window.pdfjsLib.getDocument(b.url).promise
    state.totalPages = state.pdf.numPages
    b.pages = state.totalPages
    state.page = 1; save(); renderPage()
  } catch (err) { state.pdf = null; state.totalPages = 3; renderPage() }
}
async function renderPage() {
  const canvas = $('#pdfCanvas'), ctx = canvas.getContext('2d')
  const wrap = $('#pageWrap'), layer = $('#textLayer')
  $('#pgCur').textContent = state.page
  $('#pgTot').textContent = state.totalPages
  if (state.pdf) {
    const pg = await state.pdf.getPage(state.page)
    const base = pg.getViewport({ scale: 1 })
    const scale = 720 / base.width
    const vp = pg.getViewport({ scale: scale * (window.devicePixelRatio || 1) })
    canvas.width = vp.width; canvas.height = vp.height
    canvas.style.width = '720px'; canvas.style.height = (base.height * scale) + 'px'
    wrap.style.height = (base.height * scale) + 'px'
    layer.innerHTML = ''
    await pg.render({ canvasContext: ctx, viewport: vp }).promise
  } else {
    canvas.width = 0; canvas.height = 0
    wrap.style.height = '560px'
    const t = demoText[((state.page - 1) % 3) + 1]
    layer.innerHTML = '<h4>' + t[0] + '</h4>' + t.slice(1).map(p => '<p>' + p + '</p>').join('') +
      '<p style="color:#8A8F99;font-size:13px">Sample page ' + state.page + ' - open a real PDF from Textbooks to read your own book.</p>'
  }
  sizeInk(); drawInk()
  if (state.book && state.totalPages) {
    state.book.progress = state.page / state.totalPages
    state.book.pages = state.totalPages
    save()
  }
}
$('#pgPrev').onclick = () => { if (state.page > 1) { state.page--; renderPage() } }
$('#pgNext').onclick = () => { if (state.page < state.totalPages) { state.page++; renderPage() } }

/* highlighter pen */
const ink = $('#inkCanvas')
const inkKey = () => (state.book ? state.book.id : 'demo') + ':' + state.page
function strokes() { return (state.ink[inkKey()] = state.ink[inkKey()] || []) }
function sizeInk() {
  const wrap = $('#pageWrap')
  ink.width = wrap.clientWidth; ink.height = wrap.clientHeight
  ink.style.width = wrap.clientWidth + 'px'; ink.style.height = wrap.clientHeight + 'px'
}
function drawInk() {
  const ctx = ink.getContext('2d')
  ctx.clearRect(0, 0, ink.width, ink.height)
  ctx.globalAlpha = 0.38; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  strokes().forEach(s => {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.w || 16
    ctx.beginPath()
    s.pts.forEach((p, i) => {
      const x = p[0] * ink.width, y = p[1] * ink.height
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.stroke()
  })
  ctx.globalAlpha = 1
}
let drawing = null
ink.addEventListener('pointerdown', e => {
  if (state.tool === 'select') return
  const r = ink.getBoundingClientRect()
  const pt = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  if (state.tool === 'erase') { eraseAt(pt); return }
  drawing = { color: state.color, w: 16, pts: [pt] }
  strokes().push(drawing)
  ink.setPointerCapture(e.pointerId)
})
ink.addEventListener('pointermove', e => {
  if (!drawing) return
  const r = ink.getBoundingClientRect()
  drawing.pts.push([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height])
  drawInk()
})
ink.addEventListener('pointerup', () => {
  if (!drawing) return
  drawing = null; save(); renderDash()
  /* CONNECT: await sb.from('highlights').insert({ book_id, page, stroke }) */
})
function eraseAt(pt) {
  const list = strokes()
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].pts.some(p => Math.hypot(p[0] - pt[0], (p[1] - pt[1]) * 0.6) < 0.03)) { list.splice(i, 1); break }
  }
  drawInk(); save(); renderDash()
}
$$('[data-tool]').forEach(b => {
  b.onclick = () => {
    state.tool = b.dataset.tool
    $$('[data-tool]').forEach(x => x.classList.toggle('active', x === b))
    ink.style.pointerEvents = state.tool === 'select' ? 'none' : 'auto'
    document.body.classList.toggle('pen-mode', state.tool !== 'select')
  }
})
$$('#swatches .sw').forEach(b => {
  b.onclick = () => {
    state.color = b.dataset.color
    $$('#swatches .sw').forEach(x => x.classList.toggle('active', x === b))
  }
})
ink.style.pointerEvents = 'none'
window.addEventListener('resize', () => { if ($('.view[data-view=reader]').classList.contains('active')) { sizeInk(); drawInk() } })

$('#askAi').onclick = () => {
  go('tutor')
  $('#chatBox').value = 'Summarise page ' + state.page + ' of "' + (state.book ? state.book.title : 'my textbook') + '" and quiz me on it.'
  $('#chatBox').focus()
}

/* ---------- AI tutor ---------- */
function pushMsg(role, text) {
  const d = document.createElement('div')
  d.className = 'msg ' + (role === 'user' ? 'me' : 'ai')
  d.innerHTML = '<div class="bubble">' + esc(text) + '</div>'
  $('#chatLog').appendChild(d)
  $('#chatLog').scrollTop = $('#chatLog').scrollHeight
  return d.querySelector('.bubble')
}
async function sendChat() {
  const text = $('#chatBox').value.trim(); if (!text) return
  $('#chatBox').value = ''
  pushMsg('user', text)
  const bubble = pushMsg('ai', 'Thinking...')
  const endpoint = state.sb && state.sb.url ? state.sb.url + '/functions/v1/ai-chat' : null
  if (!endpoint) {
    bubble.textContent = 'Demo mode: no model connected yet. Add your Supabase URL in Settings and deploy the ai-chat Edge Function, then this box talks to ' +
      $('#modelSel').value + ' with your key kept server-side.'
    return
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: state.sb.key, Authorization: 'Bearer ' + (state.token || state.sb.key) },
      body: JSON.stringify({ provider: $('#modelSel').value, message: text, context: { book: state.book && state.book.title, page: state.page } }),
    })
    const data = await res.json()
    bubble.textContent = data.reply || data.error || 'No reply.'
  } catch (err) { bubble.textContent = 'Could not reach the AI function: ' + err.message }
}
$('#chatSend').onclick = sendChat
$('#chatBox').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } })
$$('.chat-chips .chip').forEach(c => {
  if (c.id === 'openClaude' || c.id === 'openGpt' || c.id === 'evalWeek') return
  c.onclick = () => { $('#chatBox').value = c.textContent; sendChat() }
})
// Free-plan escape hatch: hand the question to claude.ai in a new tab.
$('#openClaude').onclick = () => {
  const q = $('#chatBox').value.trim() || 'Help me study.'
  window.open('https://claude.ai/new?q=' + encodeURIComponent(q), '_blank')
}

/* ---------- auth / supabase ---------- */
let sb = null
async function initSupabase() {
  const cfg = state.sb
  if (!cfg || !cfg.url || !cfg.key) return
  try {
    const mod = await import('https://esm.sh/@supabase/supabase-js@2')
    sb = mod.createClient(cfg.url, cfg.key)
    const { data } = await sb.auth.getSession()
    if (data && data.session) setUser(data.session.user)
    sb.auth.onAuthStateChange((_e, s) => setUser(s ? s.user : null))
    $('#modePill').textContent = 'Supabase connected'
    $('#modePill').classList.add('live')
  } catch (err) {
    $('#modePill').textContent = 'Supabase load failed'
  }
}
function setUser(u) {
  if (!u) { state.user = null; return }
  const meta = u.user_metadata || {}
  state.user = { name: meta.full_name || u.email, email: u.email, avatar: meta.avatar_url }
  state.token = null
  $('#userName').textContent = state.user.name
  $('#userMail').textContent = state.user.email
  $('#avatar').textContent = ''
  if (state.user.avatar) $('#avatar').style.backgroundImage = 'url(' + state.user.avatar + ')'
  $('#authBtn').textContent = 'Sign out'
  $('#authBtn').classList.remove('btn-google'); $('#authBtn').classList.add('btn-ghost')
  renderDash()
}
$('#authBtn').onclick = async () => {
  if (!sb) { go('settings'); $('#sbUrl').focus(); return }
  if (state.user) { await sb.auth.signOut(); location.reload(); return }
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
}
$('#sbSave').onclick = () => {
  state.sb = { url: $('#sbUrl').value.trim().replace(/\/$/, ''), key: $('#sbKey').value.trim() }
  LS.set('lumen.sb', state.sb); location.reload()
}
$('#sbClear').onclick = () => { localStorage.removeItem('lumen.sb'); location.reload() }
if (state.sb) { $('#sbUrl').value = state.sb.url || ''; $('#sbKey').value = state.sb.key || '' }

/* ---------- focus timer ---------- */
let left = 25 * 60, tick = null
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
$('#timerToggle').onclick = () => {
  if (tick) { clearInterval(tick); tick = null; $('#timerToggle').textContent = 'Start'; return }
  $('#timerToggle').textContent = 'Pause'
  tick = setInterval(() => {
    left = Math.max(0, left - 1); $('#timerDisplay').textContent = fmt(left)
    if (!left) { clearInterval(tick); tick = null; $('#timerToggle').textContent = 'Start'; logFocusMinutes(25) }
  }, 1000)
}
$('#timerReset').onclick = () => { clearInterval(tick); tick = null; left = 25 * 60; $('#timerDisplay').textContent = fmt(left); $('#timerToggle').textContent = 'Start' }

/* ---------- search ---------- */
$('#globalSearch').addEventListener('input', e => {
  const q = e.target.value.toLowerCase()
  if (!q) { renderNotes(); renderPlanner(); return }
  $('#noteList').innerHTML = state.notes.filter(n => (n.title + n.body + n.tags).toLowerCase().includes(q))
    .map(n => '<li data-note="' + n.id + '"><div class="n-t">' + esc(n.title || 'Untitled') + '</div><div class="n-s">' + esc((n.body || '').slice(0, 46)) + '</div></li>').join('') ||
    '<li class="muted small" style="padding:12px">No notes match.</li>'
})

/* ================= progress: streaks + heatmap ================= */
function dayMinutes() {
  const map = {}
  state.tasks.filter(t => t.done).forEach(t => { map[t.date] = (map[t.date] || 0) + (+t.min || 0) })
  const log = LS.get('lumen.focus', {})
  Object.keys(log).forEach(d => { map[d] = (map[d] || 0) + log[d] })
  return map
}
function renderProgress() {
  const mins = dayMinutes()
  const day = 864e5
  const iso = d => new Date(d).toISOString().slice(0, 10)
  // streaks
  let cur = 0
  for (let i = 0; ; i++) {
    const d = iso(Date.now() - i * day)
    if (mins[d]) cur++
    else if (i > 0) break
  }
  const days = Object.keys(mins).filter(d => mins[d]).sort()
  let best = 0, run = 0, prev = null
  days.forEach(d => {
    run = (prev && (new Date(d) - new Date(prev)) === day) ? run + 1 : 1
    best = Math.max(best, run); prev = d
  })
  const last30 = Object.keys(mins).filter(d => (Date.now() - new Date(d)) < 30 * day)
  const total = last30.reduce((s, d) => s + mins[d], 0)
  $('#stStreak').innerHTML = cur + ' <small>days</small>'
  $('#stStreakSub').textContent = cur ? 'studied today' : 'nothing logged today'
  $('#stBest').innerHTML = best + ' <small>days</small>'
  $('#stMin').textContent = total
  $('#stMinSub').textContent = (total / 60).toFixed(1) + ' hours'
  $('#stDays').innerHTML = last30.filter(d => mins[d]).length + ' <small>/30</small>'

  // heatmap: 18 weeks, columns = weeks, rows = Mon..Sun
  const end = new Date(); end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7) - 1))
  const start = new Date(end); start.setDate(start.getDate() - 18 * 7 + 1)
  const cells = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = iso(d)
    const m = mins[key] || 0
    const lvl = !m ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4
    cells.push('<i class="hc l' + lvl + '" title="' + key + ': ' + m + ' min"></i>')
  }
  $('#heat').innerHTML = cells.join('')

  // subject balance
  const subj = {}
  state.tasks.filter(t => t.done && (Date.now() - new Date(t.date)) < 30 * day)
    .forEach(t => { subj[t.subject] = (subj[t.subject] || 0) + (+t.min || 0) })
  const max = Math.max(1, ...Object.keys(subj).map(k => subj[k]))
  $('#subjTotals').innerHTML = Object.keys(subj).sort((x, y) => subj[y] - subj[x]).map(k =>
    '<li class="task"><div class="t-main"><div>' + esc(k) + '</div><div class="t-sub">' + subj[k] + ' min</div>' +
    '<div class="bar"><i style="width:' + Math.round(subj[k] / max * 100) + '%"></i></div></div></li>').join('') ||
    '<li class="task"><div class="t-main">Tick off some planner blocks to see subject balance.</div></li>'
}

/* log focus-timer minutes per day so streaks reflect real sessions */
function logFocusMinutes(m) {
  const log = LS.get('lumen.focus', {})
  log[todayISO()] = (log[todayISO()] || 0) + m
  LS.set('lumen.focus', log)
}

/* ================= weekly evaluation prompt ================= */
function weekSummary() {
  const day = 864e5
  const week = state.tasks.filter(t => (Date.now() - new Date(t.date)) < 7 * day)
  const done = week.filter(t => t.done)
  const bySubj = {}
  done.forEach(t => { bySubj[t.subject] = (bySubj[t.subject] || 0) + (+t.min || 0) })
  return 'Evaluate my study week and grade it out of 10, then give three concrete fixes.\n' +
    'Blocks planned: ' + week.length + ', completed: ' + done.length + '.\n' +
    'Minutes by subject: ' + (Object.keys(bySubj).map(k => k + ' ' + bySubj[k]).join(', ') || 'none') + '.\n' +
    'Notes written: ' + state.notes.length + '. Highlights saved: ' +
    Object.keys(state.ink).reduce((s, k) => s + state.ink[k].length, 0) + '.'
}
function askEval() { go('tutor'); $('#chatBox').value = weekSummary(); sendChat() }
$('#evalWeek').onclick = askEval
$('#reviewBtn').onclick = askEval

/* ChatGPT deep link (free account, new tab) */
$('#openGpt').onclick = () => {
  const q = $('#chatBox').value.trim() || weekSummary()
  window.open('https://chatgpt.com/?q=' + encodeURIComponent(q), '_blank')
}

/* ================= PDF timetable import ================= */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const WEEKDAYS = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }

function nextWeekdayISO(dow) {
  const d = new Date()
  const diff = (dow - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}
// Parses timetable lines like:
//   2026-09-15  Physics  Thermodynamics Ch.4  45m
//   Mon 9:00-10:00 | Maths | Integrals
//   15 Sep - Chemistry - Electrochemistry - 40 min
function parseTimetable(text) {
  const out = []
  text.split(/\n+/).forEach(raw => {
    const line = raw.trim()
    if (line.length < 6) return
    let date = null
    let m = line.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/)
    if (m) date = m[1] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[3]).padStart(2, '0')
    if (!date) {
      m = line.match(/\b(\d{1,2})\s*([A-Za-z]{3})[a-z]*\b/) || line.match(/\b([A-Za-z]{3})[a-z]*\s*(\d{1,2})\b/)
      if (m) {
        const a = isNaN(+m[1]) ? m[2] : m[1], b = isNaN(+m[1]) ? m[1] : m[2]
        const mo = MONTHS[String(b).slice(0, 3).toLowerCase()]
        if (mo) date = new Date().getFullYear() + '-' + String(mo).padStart(2, '0') + '-' + String(+a).padStart(2, '0')
      }
    }
    if (!date) {
      const w = line.match(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i)
      if (w) date = nextWeekdayISO(WEEKDAYS[w[1].toLowerCase()])
    }
    if (!date) return
    const mm = line.match(/(\d{2,3})\s*(?:m\b|min)/i)
    let minutes = mm ? +mm[1] : null
    const range = line.match(/(\d{1,2})[:.](\d{2})\s*[-\u2013to]+\s*(\d{1,2})[:.](\d{2})/)
    if (!minutes && range) minutes = (+range[3] * 60 + +range[4]) - (+range[1] * 60 + +range[2])
    if (!minutes || minutes <= 0) minutes = 45
    const rest = line
      .replace(/(20\d{2})[-/]\d{1,2}[-/]\d{1,2}/g, '')
      .replace(/\d{1,2}[:.]\d{2}\s*[-\u2013to]*\s*\d{0,2}[:.]?\d{0,2}/g, '')
      .replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/gi, '')
      .replace(/\b\d{2,3}\s*(m\b|min[a-z]*)/gi, '')
      .replace(/\b\d{1,2}\s*[A-Za-z]{3}[a-z]*\b/g, '')
      .split(/[|\u2013\u2014\t]|\s{2,}|\s-\s/).map(s => s.trim()).filter(Boolean)
    if (!rest.length) return
    out.push({
      id: uid(),
      subject: rest[0].slice(0, 40) || 'Study',
      topic: (rest.slice(1).join(' \u2014 ') || rest[0]).slice(0, 120),
      date: date, min: minutes, done: false,
    })
  })
  return out
}
async function pdfToText(file) {
  if (file.type === 'text/plain') return await file.text()
  if (!window.pdfjsLib) throw new Error('PDF.js not loaded \u2014 serve the app over http, not file://')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  const buf = await file.arrayBuffer()
  const doc = await window.pdfjsLib.getDocument({ data: buf }).promise
  let text = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    let lastY = null, line = ''
    content.items.forEach(it => {
      const y = Math.round(it.transform[5])
      if (lastY !== null && Math.abs(y - lastY) > 3) { text += line.trim() + '\n'; line = '' }
      line += it.str + ' '
      lastY = y
    })
    text += line.trim() + '\n'
  }
  return text
}
const ttStatus = (msg, err) => {
  const el = $('#ttStatus')
  el.hidden = false; el.textContent = msg
  el.classList.toggle('err', !!err)
}
if ($('#ttInput')) $('#ttInput').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return
  ttStatus('Reading ' + file.name + '\u2026')
  try {
    const text = await pdfToText(file)
    const rows = parseTimetable(text)
    if (!rows.length) {
      ttStatus('No schedule rows recognised. Each line needs a date or weekday plus a subject, e.g. "2026-09-15  Physics  Ch. 4  45m". See ROADMAP.md for the AI-assisted importer.', true)
      return
    }
    state.tasks = state.tasks.concat(rows)
    save(); renderPlanner(); renderDash()
    ttStatus('Imported ' + rows.length + ' block' + (rows.length > 1 ? 's' : '') + ' from ' + file.name + '.')
    /* CONNECT: await sb.from("tasks").insert(rows.map(toRow)) */
  } catch (err) { ttStatus('Could not read that file: ' + err.message, true) }
  e.target.value = ''
})

/* ---------- boot ---------- */
$('#pDate').value = todayISO()
renderDash(); renderPlanner(); renderBooks(); renderNotes()
loadNote(state.notes[0] && state.notes[0].id)
initSupabase()
if (location.hash) {
  const v = location.hash.slice(1)
  if (v === 'reader' && state.books[0]) openBook(state.books[0].id)
  else go(v)
}
